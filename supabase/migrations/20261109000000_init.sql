-- Nook: schema, row-level security, and the RPCs the app calls.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table households (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table members (                          -- Frank, Sarah and the tablet
  user_id      uuid primary key references auth.users on delete cascade,
  household_id uuid not null references households on delete cascade,
  person       text check (person in ('a', 'b')),   -- a = Frank, b = Sarah, null = the tablet
  name         text not null,
  pin_hash     text                                  -- extensions.crypt('1234', extensions.gen_salt('bf'))
);

create function my_household() returns uuid language sql stable security definer set search_path = public
as $$ select household_id from members where user_id = auth.uid() $$;

create table plans (                             -- the Floorplan `plan` prop, as-is
  household_id uuid primary key references households on delete cascade default my_household(),
  data         jsonb not null,
  updated_at   timestamptz not null default now()
);

create table chores (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade default my_household(),
  title         text not null,
  target_id     text not null,                    -- a room or item id in plans.data
  icon          text,
  interval_days numeric check (interval_days > 0),
  use_limit     int check (use_limit > 0),        -- 1 = after each use
  uses          int not null default 0,
  last_done_at  timestamptz,
  snoozed_until timestamptz,
  created_at    timestamptz not null default now(),
  check (interval_days is not null or use_limit is not null)
);

create table chore_log (                         -- deliberately no user column: no attribution, no comparisons
  id       bigint generated always as identity primary key,
  chore_id uuid not null references chores on delete cascade,
  kind     text not null check (kind in ('done', 'snooze', 'use')),
  at       timestamptz not null default now()
);

create table task_categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade default my_household(),
  name         text not null,
  icon         text not null default 'folder',
  sort         int not null default 0
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade default my_household(),
  title        text not null,
  notes        text,
  due_on       date,
  done_at      timestamptz,
  category_id  uuid references task_categories on delete cascade,   -- shared task …
  owner        uuid references auth.users on delete cascade,        -- … or private task
  created_at   timestamptz not null default now(),
  check ((category_id is null) <> (owner is null))
);

create table shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade default my_household(),
  name         text not null,
  qty          int not null default 1 check (qty > 0),
  bought_at    timestamptz,                       -- ticked
  cleared_at   timestamptz,                       -- hidden after "Clear"; kept so usuals can learn
  created_at   timestamptz not null default now()
);

create view shopping_usuals with (security_invoker = on) as
  select initcap(lower(name)) as name, count(*) as times
  from shopping_items
  where created_at > now() - interval '90 days'
  group by lower(name) having count(*) >= 3
  order by times desc limit 12;

-- ---------------------------------------------------------------- row-level security

alter table members enable row level security;
alter table plans enable row level security;
alter table chores enable row level security;
alter table chore_log enable row level security;
alter table task_categories enable row level security;
alter table tasks enable row level security;
alter table shopping_items enable row level security;

create policy read_household on members for select using (household_id = my_household());
create policy household on plans           for all using (household_id = my_household()) with check (household_id = my_household());
create policy household on chores          for all using (household_id = my_household()) with check (household_id = my_household());
create policy household on task_categories for all using (household_id = my_household()) with check (household_id = my_household());
create policy household on shopping_items  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household on chore_log       for all
  using (exists (select 1 from chores c where c.id = chore_id and c.household_id = my_household()))
  with check (exists (select 1 from chores c where c.id = chore_id and c.household_id = my_household()));

create policy shared_tasks on tasks for all
  using (household_id = my_household() and owner is null)
  with check (household_id = my_household() and owner is null);
create policy own_private on tasks for all using (owner = auth.uid()) with check (owner = auth.uid());

-- members.pin_hash must never reach the client: grant every column but that one
revoke all on members from anon, authenticated;
grant select (user_id, household_id, person, name) on members to authenticated;

-- ---------------------------------------------------------------- chore actions (run as the caller, so RLS applies)

create function complete_chore(p_id uuid) returns chores language sql as $$
  insert into chore_log (chore_id, kind) values (p_id, 'done');
  update chores set last_done_at = now(), uses = 0, snoozed_until = null where id = p_id returning *;
$$;

create function snooze_chore(p_id uuid) returns chores language sql as $$
  insert into chore_log (chore_id, kind) values (p_id, 'snooze');
  update chores set snoozed_until = date_trunc('day', now()) + interval '1 day 6 hours' where id = p_id returning *;
$$;

create function log_use(p_id uuid) returns chores language sql as $$
  insert into chore_log (chore_id, kind) values (p_id, 'use');
  update chores set uses = uses + 1 where id = p_id returning *;
$$;

-- ---------------------------------------------------------------- private lists on the shared tablet

create function check_pin(p_person text, p_pin text) returns members
language plpgsql security definer set search_path = public, extensions as $$
declare m members;
begin
  select * into m from members where household_id = my_household() and person = p_person;
  if not found or m.pin_hash is null or m.pin_hash <> crypt(p_pin, m.pin_hash) then
    raise exception 'wrong pin' using errcode = '28000';
  end if;
  return m;
end $$;
revoke execute on function check_pin(text, text) from public, anon, authenticated;

create function private_tasks(p_person text, p_pin text) returns setof tasks
language plpgsql security definer set search_path = public, extensions as $$
declare m members;
begin
  m := check_pin(p_person, p_pin);
  return query select * from tasks where owner = m.user_id order by done_at nulls first, due_on nulls last, created_at;
end $$;

create function save_private_task(p_person text, p_pin text, p_id uuid, p_title text, p_done boolean, p_due date default null)
returns tasks language plpgsql security definer set search_path = public, extensions as $$
declare m members; t tasks;
begin
  m := check_pin(p_person, p_pin);
  insert into tasks (id, household_id, owner, title, due_on, done_at)
  values (coalesce(p_id, gen_random_uuid()), m.household_id, m.user_id, p_title, p_due, case when p_done then now() end)
  on conflict (id) do update set title = excluded.title, due_on = excluded.due_on, done_at = excluded.done_at
    where tasks.owner = m.user_id
  returning * into t;
  return t;
end $$;

create function set_pin(p_pin text) returns void
language sql security definer set search_path = public, extensions as $$
  update members set pin_hash = crypt(p_pin, gen_salt('bf')) where user_id = auth.uid() and person is not null;
$$;

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table plans, chores, task_categories, tasks, shopping_items;
