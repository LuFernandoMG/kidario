create table if not exists booking_activity_plans (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  teacher_profile_id uuid not null references teacher_profiles(profile_id) on delete restrict,
  child_id uuid not null references parent_children(id) on delete restrict,
  source text not null check (source in ('llm', 'fallback')),
  activities jsonb not null default '[]'::jsonb,
  context_hash text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(activities) = 'array')
);

create index if not exists idx_booking_activity_plans_teacher_profile_id
  on booking_activity_plans(teacher_profile_id);
create index if not exists idx_booking_activity_plans_child_id
  on booking_activity_plans(child_id);
create index if not exists idx_booking_activity_plans_generated_at
  on booking_activity_plans(generated_at desc);

alter table if exists booking_activity_plans enable row level security;

drop policy if exists booking_activity_plans_service_all on booking_activity_plans;
create policy booking_activity_plans_service_all
on booking_activity_plans
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists booking_activity_plans_owner_select on booking_activity_plans;
create policy booking_activity_plans_owner_select
on booking_activity_plans
for select
to authenticated
using (
  exists (
    select 1
    from bookings b
    where b.id = booking_activity_plans.booking_id
      and (
        b.parent_profile_id = auth.uid()
        or b.teacher_profile_id = auth.uid()
      )
  )
);

drop policy if exists booking_activity_plans_teacher_insert on booking_activity_plans;
create policy booking_activity_plans_teacher_insert
on booking_activity_plans
for insert
to authenticated
with check (
  teacher_profile_id = auth.uid()
  and exists (
    select 1
    from bookings b
    where b.id = booking_activity_plans.booking_id
      and b.teacher_profile_id = auth.uid()
      and b.child_id = booking_activity_plans.child_id
  )
);

drop policy if exists booking_activity_plans_teacher_update on booking_activity_plans;
create policy booking_activity_plans_teacher_update
on booking_activity_plans
for update
to authenticated
using (teacher_profile_id = auth.uid())
with check (
  teacher_profile_id = auth.uid()
  and exists (
    select 1
    from bookings b
    where b.id = booking_activity_plans.booking_id
      and b.teacher_profile_id = auth.uid()
      and b.child_id = booking_activity_plans.child_id
  )
);

drop policy if exists booking_activity_plans_teacher_delete on booking_activity_plans;
create policy booking_activity_plans_teacher_delete
on booking_activity_plans
for delete
to authenticated
using (teacher_profile_id = auth.uid());
