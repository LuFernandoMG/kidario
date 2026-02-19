-- Kidario RLS baseline for profile domain tables
-- Apply after 001_init_profiles.sql

-- 1) Enable RLS on all domain tables
alter table if exists profiles enable row level security;
alter table if exists parent_profiles enable row level security;
alter table if exists parent_children enable row level security;
alter table if exists teacher_profiles enable row level security;
alter table if exists teacher_specialties enable row level security;
alter table if exists teacher_formations enable row level security;
alter table if exists teacher_experiences enable row level security;
alter table if exists teacher_availability enable row level security;

-- 2) Trusted backend/service roles: full access
--    Keep this to avoid breaking FastAPI direct DB access.
drop policy if exists profiles_service_all on profiles;
create policy profiles_service_all
on profiles
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists parent_profiles_service_all on parent_profiles;
create policy parent_profiles_service_all
on parent_profiles
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists parent_children_service_all on parent_children;
create policy parent_children_service_all
on parent_children
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists teacher_profiles_service_all on teacher_profiles;
create policy teacher_profiles_service_all
on teacher_profiles
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists teacher_specialties_service_all on teacher_specialties;
create policy teacher_specialties_service_all
on teacher_specialties
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists teacher_formations_service_all on teacher_formations;
create policy teacher_formations_service_all
on teacher_formations
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists teacher_experiences_service_all on teacher_experiences;
create policy teacher_experiences_service_all
on teacher_experiences
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists teacher_availability_service_all on teacher_availability;
create policy teacher_availability_service_all
on teacher_availability
for all
to service_role, postgres
using (true)
with check (true);

-- 3) Authenticated users: owner-based access
-- profiles
drop policy if exists profiles_owner_select on profiles;
create policy profiles_owner_select
on profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_owner_insert on profiles;
create policy profiles_owner_insert
on profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and role in ('parent', 'teacher')
);

drop policy if exists profiles_owner_update on profiles;
create policy profiles_owner_update
on profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role in ('parent', 'teacher')
);

-- parent_profiles
drop policy if exists parent_profiles_owner_select on parent_profiles;
create policy parent_profiles_owner_select
on parent_profiles
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists parent_profiles_owner_insert on parent_profiles;
create policy parent_profiles_owner_insert
on parent_profiles
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'parent'
  )
);

drop policy if exists parent_profiles_owner_update on parent_profiles;
create policy parent_profiles_owner_update
on parent_profiles
for update
to authenticated
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'parent'
  )
);

-- parent_children
drop policy if exists parent_children_owner_select on parent_children;
create policy parent_children_owner_select
on parent_children
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists parent_children_owner_insert on parent_children;
create policy parent_children_owner_insert
on parent_children
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from parent_profiles pp
    where pp.profile_id = auth.uid()
  )
);

drop policy if exists parent_children_owner_update on parent_children;
create policy parent_children_owner_update
on parent_children
for update
to authenticated
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from parent_profiles pp
    where pp.profile_id = auth.uid()
  )
);

drop policy if exists parent_children_owner_delete on parent_children;
create policy parent_children_owner_delete
on parent_children
for delete
to authenticated
using (profile_id = auth.uid());

-- teacher_profiles
drop policy if exists teacher_profiles_owner_select on teacher_profiles;
create policy teacher_profiles_owner_select
on teacher_profiles
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists teacher_profiles_owner_insert on teacher_profiles;
create policy teacher_profiles_owner_insert
on teacher_profiles
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

drop policy if exists teacher_profiles_owner_update on teacher_profiles;
create policy teacher_profiles_owner_update
on teacher_profiles
for update
to authenticated
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

-- teacher_specialties
drop policy if exists teacher_specialties_owner_select on teacher_specialties;
create policy teacher_specialties_owner_select
on teacher_specialties
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists teacher_specialties_owner_insert on teacher_specialties;
create policy teacher_specialties_owner_insert
on teacher_specialties
for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists teacher_specialties_owner_update on teacher_specialties;
create policy teacher_specialties_owner_update
on teacher_specialties
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists teacher_specialties_owner_delete on teacher_specialties;
create policy teacher_specialties_owner_delete
on teacher_specialties
for delete
to authenticated
using (profile_id = auth.uid());

-- teacher_formations
drop policy if exists teacher_formations_owner_select on teacher_formations;
create policy teacher_formations_owner_select
on teacher_formations
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists teacher_formations_owner_insert on teacher_formations;
create policy teacher_formations_owner_insert
on teacher_formations
for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists teacher_formations_owner_update on teacher_formations;
create policy teacher_formations_owner_update
on teacher_formations
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists teacher_formations_owner_delete on teacher_formations;
create policy teacher_formations_owner_delete
on teacher_formations
for delete
to authenticated
using (profile_id = auth.uid());

-- teacher_experiences
drop policy if exists teacher_experiences_owner_select on teacher_experiences;
create policy teacher_experiences_owner_select
on teacher_experiences
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists teacher_experiences_owner_insert on teacher_experiences;
create policy teacher_experiences_owner_insert
on teacher_experiences
for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists teacher_experiences_owner_update on teacher_experiences;
create policy teacher_experiences_owner_update
on teacher_experiences
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists teacher_experiences_owner_delete on teacher_experiences;
create policy teacher_experiences_owner_delete
on teacher_experiences
for delete
to authenticated
using (profile_id = auth.uid());

-- teacher_availability
drop policy if exists teacher_availability_owner_select on teacher_availability;
create policy teacher_availability_owner_select
on teacher_availability
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists teacher_availability_owner_insert on teacher_availability;
create policy teacher_availability_owner_insert
on teacher_availability
for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists teacher_availability_owner_update on teacher_availability;
create policy teacher_availability_owner_update
on teacher_availability
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists teacher_availability_owner_delete on teacher_availability;
create policy teacher_availability_owner_delete
on teacher_availability
for delete
to authenticated
using (profile_id = auth.uid());
