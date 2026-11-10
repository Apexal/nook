-- Hardening after a review: lock down households, keep private tasks inside the household,
-- snooze on the tablet's clock, and stop the 4-digit PIN being guessed.

-- ---------------------------------------------------------------- households: no row-level security until now
-- Without RLS, any signed-in user (and possibly the anon key) could read, rename or delete every household,
-- and a delete cascades to all of its data. Members may read their own; changes go through the SQL editor.
alter table households enable row level security;
create policy read_own on households for select using (id = my_household());

-- ---------------------------------------------------------------- private tasks stay in the owner's household
drop policy own_private on tasks;
create policy own_private on tasks for all
  using (owner = auth.uid() and household_id = my_household())
  with check (owner = auth.uid() and household_id = my_household());

-- ---------------------------------------------------------------- snooze until 06:00 tomorrow on the device's clock
-- The old version used 06:00 UTC. The app now sends the time; without one it falls back to the old rule.
-- It is clamped to the next two days, so a client can't snooze a chore for good.
drop function snooze_chore(uuid);
create function snooze_chore(p_id uuid, p_until timestamptz default null) returns chores language sql as $$
  insert into chore_log (chore_id, kind) values (p_id, 'snooze');
  update chores set snoozed_until = case
      when p_until is null then date_trunc('day', now()) + interval '1 day 6 hours'
      else least(greatest(p_until, now()), now() + interval '2 days')
    end
  where id = p_id returning *;
$$;

-- ---------------------------------------------------------------- PIN attempts
-- 4 digits is 10,000 guesses. After 5 wrong PINs in a row the household waits 2 minutes, then 4, 8, … up to a day,
-- for every further wrong one. A right PIN clears the count.
create table pin_attempts (
  household_id uuid primary key references households on delete cascade,
  failures     int not null default 0,
  locked_until timestamptz
);
alter table pin_attempts enable row level security;
revoke all on pin_attempts from anon, authenticated;   -- only the security-definer functions below touch it

-- Wrong PINs return false instead of raising: an exception would roll back the failure count with it.
create function check_tasks_pin(p_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare hh uuid := my_household(); h text; a pin_attempts;
begin
  if hh is null then raise exception 'not a household member' using errcode = '42501'; end if;
  select * into a from pin_attempts where household_id = hh for update;
  if a.locked_until > now() then
    raise exception 'too many tries' using errcode = '28000', hint = 'try again after ' || a.locked_until;
  end if;
  select pin_hash into h from household_pins where household_id = hh;
  if h is not null and h = crypt(p_pin, h) then
    delete from pin_attempts where household_id = hh;
    return true;
  end if;
  insert into pin_attempts as p (household_id, failures) values (hh, 1)
  on conflict (household_id) do update set
    failures = p.failures + 1,
    locked_until = case when p.failures + 1 >= 5
      then now() + least(interval '1 minute' * power(2, p.failures - 3), interval '1 day') end;
  return false;
end $$;
revoke execute on function check_tasks_pin(text) from public, anon;
grant execute on function check_tasks_pin(text) to authenticated;

-- The member whose list the PIN opens, or null for a wrong PIN (counted above).
create or replace function check_pin(p_person text, p_pin text) returns members
language plpgsql security definer set search_path = public, extensions as $$
declare m members;
begin
  if not check_tasks_pin(p_pin) then return null; end if;
  select * into m from members where household_id = my_household() and person = p_person;
  return m;
end $$;
revoke execute on function check_pin(text, text) from public, anon, authenticated;

-- A wrong PIN returns no rows (the app checks the PIN first with check_tasks_pin).
create or replace function private_tasks(p_person text, p_pin text) returns setof tasks
language plpgsql security definer set search_path = public, extensions as $$
declare m members;
begin
  m := check_pin(p_person, p_pin);
  if m.user_id is null then return; end if;
  return query select * from tasks where owner = m.user_id order by done_at nulls first, due_on nulls last, created_at;
end $$;

-- A wrong PIN returns null, which the app reports as "wrong pin".
create or replace function save_private_task(p_person text, p_pin text, p_id uuid, p_title text, p_done boolean, p_due date default null)
returns tasks language plpgsql security definer set search_path = public, extensions as $$
declare m members; t tasks;
begin
  m := check_pin(p_person, p_pin);
  if m.user_id is null then return null; end if;
  insert into tasks (id, household_id, owner, title, due_on, done_at)
  values (coalesce(p_id, gen_random_uuid()), m.household_id, m.user_id, p_title, p_due, case when p_done then now() end)
  on conflict (id) do update set title = excluded.title, due_on = excluded.due_on, done_at = excluded.done_at
    where tasks.owner = m.user_id
  returning * into t;
  return t;
end $$;
