-- Kidario API v2 cutover.
--
-- The backend no longer writes compatibility columns used by the legacy v1
-- contracts. Keep the columns nullable for historical data and remove sync
-- triggers that would create duplicate payment records.

alter table if exists public.bookings
  alter column parent_profile_id drop not null,
  alter column teacher_profile_id drop not null,
  alter column date_iso drop not null,
  alter column time drop not null,
  alter column payment_method drop not null,
  alter column payment_status drop not null,
  alter column price_total drop not null;

drop trigger if exists trg_sync_payment_from_booking on public.bookings;

create unique index if not exists idx_bookings_teacher_starts_at_active_unique
  on public.bookings(teacher_id, starts_at)
  where status in ('pendente', 'confirmada');

alter table if exists public.chat_threads
  alter column parent_profile_id drop not null,
  alter column teacher_profile_id drop not null;

alter table if exists public.chat_messages
  alter column sender_profile_id drop not null;

alter table if exists public.teacher_availability
  alter column profile_id drop not null;

create unique index if not exists idx_teacher_availability_teacher_slot_unique
  on public.teacher_availability(teacher_id, day_of_week, start_time, end_time)
  where teacher_id is not null;

alter table if exists public.teacher_experiences
  alter column profile_id drop not null,
  alter column responsibilities drop not null;

alter table if exists public.booking_follow_ups
  add column if not exists teacher_id uuid,
  alter column teacher_profile_id drop not null;

update public.booking_follow_ups bf
set teacher_id = b.teacher_id
from public.bookings b
where b.id = bf.booking_id
  and bf.teacher_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_follow_ups_teacher_id_fkey'
      and conrelid = 'public.booking_follow_ups'::regclass
  ) then
    alter table public.booking_follow_ups
      add constraint booking_follow_ups_teacher_id_fkey
      foreign key (teacher_id)
      references public.teachers(id)
      on delete restrict
      not valid;
  end if;
end
$$;

create index if not exists idx_booking_follow_ups_teacher_id
  on public.booking_follow_ups(teacher_id);

alter table if exists public.booking_activity_plans
  add column if not exists teacher_id uuid,
  alter column teacher_profile_id drop not null;

update public.booking_activity_plans bap
set teacher_id = b.teacher_id
from public.bookings b
where b.id = bap.booking_id
  and bap.teacher_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_activity_plans_teacher_id_fkey'
      and conrelid = 'public.booking_activity_plans'::regclass
  ) then
    alter table public.booking_activity_plans
      add constraint booking_activity_plans_teacher_id_fkey
      foreign key (teacher_id)
      references public.teachers(id)
      on delete restrict
      not valid;
  end if;
end
$$;

create index if not exists idx_booking_activity_plans_teacher_id
  on public.booking_activity_plans(teacher_id);
