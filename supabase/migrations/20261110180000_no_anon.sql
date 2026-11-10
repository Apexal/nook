-- Nook has no public pages: every request comes from a signed-in household member.
-- Supabase grants the anon role (the publishable key alone) access to everything in public by default,
-- leaving row-level security as the only guard. Take that access away so a missing policy can't expose data.

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;

alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon, public;

-- Signed-in members call these (RLS and the PIN checks still apply). check_pin stays internal.
grant execute on function my_household()                                        to authenticated;
grant execute on function complete_chore(uuid)                                  to authenticated;
grant execute on function snooze_chore(uuid, timestamptz)                       to authenticated;
grant execute on function log_use(uuid)                                         to authenticated;
grant execute on function check_tasks_pin(text)                                 to authenticated;
grant execute on function private_tasks(text, text)                             to authenticated;
grant execute on function save_private_task(text, text, uuid, text, boolean, date) to authenticated;
grant execute on function set_pin(text)                                         to authenticated;
