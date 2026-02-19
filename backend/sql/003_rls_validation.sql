-- Kidario RLS validation script (manual smoke test)
-- Run after:
--   001_init_profiles.sql
--   002_rls_profiles.sql
--
-- How to use:
-- 1) Replace only the two UUID values in the temp table below.
-- 2) Run each block independently in Supabase SQL Editor.
-- 3) Compare output with expected behavior comments.

-- Configure test users once (replace with real auth.users.id)
drop table if exists tmp_rls_ids;
create temporary table tmp_rls_ids (
  uuid_a uuid not null,
  uuid_b uuid not null
) on commit preserve rows;

insert into tmp_rls_ids (uuid_a, uuid_b)
values (
  '00000000-0000-0000-0000-000000000001', -- UUID_A
  '00000000-0000-0000-0000-000000000002'  -- UUID_B
);

-- =========================================================
-- Block A: Simulate user A (authenticated + auth.uid = UUID_A)
-- Expected:
-- - Can read/update own rows.
-- - Cannot read/update user B rows (0 rows affected/returned).
-- =========================================================
begin;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  (select uuid_a::text from tmp_rls_ids limit 1),
  true
);

-- Own profile: should return 1 row (if user A already onboarded)
select id, email, role
from profiles
where id = (select uuid_a from tmp_rls_ids limit 1);

-- Other profile: should return 0 rows
select id, email, role
from profiles
where id = (select uuid_b from tmp_rls_ids limit 1);

-- Own update: should return 1 row (if row exists)
update profiles
set updated_at = now()
where id = (select uuid_a from tmp_rls_ids limit 1)
returning id;

-- Cross update: should return 0 rows
update profiles
set updated_at = now()
where id = (select uuid_b from tmp_rls_ids limit 1)
returning id;

-- Cross child read: should return 0 rows
select id, profile_id, name
from parent_children
where profile_id = (select uuid_b from tmp_rls_ids limit 1)
limit 5;

rollback;

-- =========================================================
-- Block B: Simulate user B (authenticated + auth.uid = UUID_B)
-- Expected:
-- - Can read/update own rows.
-- - Cannot read/update user A rows (0 rows affected/returned).
-- =========================================================
begin;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  (select uuid_b::text from tmp_rls_ids limit 1),
  true
);

-- Own profile: should return 1 row (if user B already onboarded)
select id, email, role
from profiles
where id = (select uuid_b from tmp_rls_ids limit 1);

-- Other profile: should return 0 rows
select id, email, role
from profiles
where id = (select uuid_a from tmp_rls_ids limit 1);

-- Own update: should return 1 row (if row exists)
update profiles
set updated_at = now()
where id = (select uuid_b from tmp_rls_ids limit 1)
returning id;

-- Cross update: should return 0 rows
update profiles
set updated_at = now()
where id = (select uuid_a from tmp_rls_ids limit 1)
returning id;

-- Cross availability read: should return 0 rows
select id, profile_id, day_of_week, start_time, end_time
from teacher_availability
where profile_id = (select uuid_a from tmp_rls_ids limit 1)
limit 5;

rollback;

-- =========================================================
-- Optional negative test: INSERT with mismatched owner should fail
-- (violates WITH CHECK profile_id = auth.uid()).
-- =========================================================
begin;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  (select uuid_a::text from tmp_rls_ids limit 1),
  true
);

insert into parent_children (id, profile_id, name)
values (gen_random_uuid(), (select uuid_b from tmp_rls_ids limit 1), 'Should fail');

rollback;
