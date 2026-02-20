-- Kidario RLS baseline for bookings domain tables
-- Apply after:
--   001_init_profiles.sql
--   002_rls_profiles.sql
--   004_init_bookings.sql

alter table if exists bookings enable row level security;
alter table if exists booking_follow_ups enable row level security;

-- Trusted backend/service roles: full access
drop policy if exists bookings_service_all on bookings;
create policy bookings_service_all
on bookings
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists booking_follow_ups_service_all on booking_follow_ups;
create policy booking_follow_ups_service_all
on booking_follow_ups
for all
to service_role, postgres
using (true)
with check (true);

-- Authenticated users
-- bookings: parent owner OR teacher owner can read
drop policy if exists bookings_owner_select on bookings;
create policy bookings_owner_select
on bookings
for select
to authenticated
using (
  parent_profile_id = auth.uid()
  or teacher_profile_id = auth.uid()
);

-- bookings: only parent owner can insert
drop policy if exists bookings_parent_insert on bookings;
create policy bookings_parent_insert
on bookings
for insert
to authenticated
with check (
  parent_profile_id = auth.uid()
  and exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'parent'
  )
);

-- bookings: parent owner or teacher owner can update own records
drop policy if exists bookings_owner_update on bookings;
create policy bookings_owner_update
on bookings
for update
to authenticated
using (
  parent_profile_id = auth.uid()
  or teacher_profile_id = auth.uid()
)
with check (
  parent_profile_id = auth.uid()
  or teacher_profile_id = auth.uid()
);

-- bookings: only parent owner can delete
drop policy if exists bookings_parent_delete on bookings;
create policy bookings_parent_delete
on bookings
for delete
to authenticated
using (parent_profile_id = auth.uid());

-- booking_follow_ups: parent owner OR teacher owner can read
drop policy if exists booking_follow_ups_owner_select on booking_follow_ups;
create policy booking_follow_ups_owner_select
on booking_follow_ups
for select
to authenticated
using (
  exists (
    select 1
    from bookings b
    where b.id = booking_follow_ups.booking_id
      and (
        b.parent_profile_id = auth.uid()
        or b.teacher_profile_id = auth.uid()
      )
  )
);

-- booking_follow_ups: only teacher owner can insert
drop policy if exists booking_follow_ups_teacher_insert on booking_follow_ups;
create policy booking_follow_ups_teacher_insert
on booking_follow_ups
for insert
to authenticated
with check (
  teacher_profile_id = auth.uid()
  and exists (
    select 1
    from bookings b
    where b.id = booking_follow_ups.booking_id
      and b.teacher_profile_id = auth.uid()
  )
);

-- booking_follow_ups: only teacher owner can update
drop policy if exists booking_follow_ups_teacher_update on booking_follow_ups;
create policy booking_follow_ups_teacher_update
on booking_follow_ups
for update
to authenticated
using (teacher_profile_id = auth.uid())
with check (
  teacher_profile_id = auth.uid()
  and exists (
    select 1
    from bookings b
    where b.id = booking_follow_ups.booking_id
      and b.teacher_profile_id = auth.uid()
  )
);

-- booking_follow_ups: only teacher owner can delete
drop policy if exists booking_follow_ups_teacher_delete on booking_follow_ups;
create policy booking_follow_ups_teacher_delete
on booking_follow_ups
for delete
to authenticated
using (teacher_profile_id = auth.uid());
