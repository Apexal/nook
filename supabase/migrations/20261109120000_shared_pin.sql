-- One PIN for the household instead of one per person. It opens Frank's and Sarah's private lists on the tablet.

create table household_pins (
  household_id uuid primary key references households on delete cascade,
  pin_hash     text not null                      -- extensions.crypt('1234', extensions.gen_salt('bf'))
);
alter table household_pins enable row level security;
revoke all on household_pins from anon, authenticated;   -- only the security-definer functions below read it

alter table members drop column pin_hash;

create or replace function check_pin(p_person text, p_pin text) returns members
language plpgsql security definer set search_path = public, extensions as $$
declare m members; h text;
begin
  select * into m from members where household_id = my_household() and person = p_person;
  select pin_hash into h from household_pins where household_id = my_household();
  if m.user_id is null or h is null or h <> crypt(p_pin, h) then
    raise exception 'wrong pin' using errcode = '28000';
  end if;
  return m;
end $$;
revoke execute on function check_pin(text, text) from public, anon, authenticated;

-- Frank or Sarah, signed in on a phone, can change the shared PIN.
create or replace function set_pin(p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from members where user_id = auth.uid() and person is not null) then
    raise exception 'only Frank or Sarah can set the PIN' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'the PIN is 4 digits' using errcode = '22023';
  end if;
  insert into household_pins (household_id, pin_hash) values (my_household(), crypt(p_pin, gen_salt('bf')))
  on conflict (household_id) do update set pin_hash = excluded.pin_hash;
end $$;
