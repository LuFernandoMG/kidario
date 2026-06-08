alter table if exists public.booking_packages
  add column if not exists requested_first_booking_starts_at timestamptz,
  add column if not exists requested_first_booking_duration_minutes integer,
  add column if not exists requested_first_booking_modality text,
  add column if not exists first_booking_id uuid;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'booking_packages_requested_first_booking_duration_check'
      and conrelid = 'public.booking_packages'::regclass
  ) then
    alter table public.booking_packages
      drop constraint booking_packages_requested_first_booking_duration_check;
  end if;

  alter table public.booking_packages
    add constraint booking_packages_requested_first_booking_duration_check
    check (
      requested_first_booking_duration_minutes is null
      or requested_first_booking_duration_minutes between 15 and 300
    );

  if exists (
    select 1 from pg_constraint
    where conname = 'booking_packages_requested_first_booking_modality_check'
      and conrelid = 'public.booking_packages'::regclass
  ) then
    alter table public.booking_packages
      drop constraint booking_packages_requested_first_booking_modality_check;
  end if;

  alter table public.booking_packages
    add constraint booking_packages_requested_first_booking_modality_check
    check (
      requested_first_booking_modality is null
      or requested_first_booking_modality in ('online', 'presencial')
    );

  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_packages_first_booking_fkey'
      and conrelid = 'public.booking_packages'::regclass
  ) then
    alter table public.booking_packages
      add constraint booking_packages_first_booking_fkey
      foreign key (first_booking_id)
      references public.bookings(id)
      on delete set null
      not valid;
  end if;
end
$$;

create index if not exists idx_booking_packages_first_booking_id
  on public.booking_packages(first_booking_id)
  where first_booking_id is not null;
