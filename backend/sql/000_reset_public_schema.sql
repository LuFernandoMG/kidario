-- DANGER: destructive reset for a Supabase project during early development.
--
-- This drops everything in the public schema, including all Kidario tables,
-- data, functions, triggers, policies and views. Supabase Auth data in
-- auth.users is not dropped because it lives in the auth schema.
--
-- Use only when you intentionally want to start the public schema from zero.
-- After this script, run the numbered Kidario SQL scripts again in order.

begin;

drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables to postgres, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant all on functions to postgres, service_role;

alter default privileges in schema public
  grant execute on functions to anon, authenticated;

alter default privileges in schema public
  grant all on sequences to postgres, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

commit;
