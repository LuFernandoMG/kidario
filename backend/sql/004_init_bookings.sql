create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references parent_profiles(profile_id) on delete restrict,
  child_id uuid not null references parent_children(id) on delete restrict,
  teacher_profile_id uuid not null references teacher_profiles(profile_id) on delete restrict,
  date_iso date not null,
  time text not null,
  duration_minutes int not null check (duration_minutes between 15 and 300),
  modality text not null check (modality in ('online', 'presencial')),
  status text not null check (status in ('pendente', 'confirmada', 'cancelada', 'concluida')),
  payment_method text not null check (payment_method in ('cartao', 'pix')),
  payment_status text not null check (payment_status in ('pendente', 'pago', 'falhou')),
  price_total numeric(10,2) not null check (price_total >= 0),
  currency text not null default 'BRL',
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (time ~ '^[0-2][0-9]:[0-5][0-9]$')
);

create index if not exists idx_bookings_parent_profile_id on bookings(parent_profile_id);
create index if not exists idx_bookings_child_id on bookings(child_id);
create index if not exists idx_bookings_teacher_profile_id on bookings(teacher_profile_id);
create index if not exists idx_bookings_date_iso on bookings(date_iso);
create unique index if not exists idx_bookings_teacher_slot_active
  on bookings(teacher_profile_id, date_iso, time)
  where status in ('pendente', 'confirmada');

create table if not exists booking_follow_ups (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  teacher_profile_id uuid not null references teacher_profiles(profile_id) on delete restrict,
  child_id uuid not null references parent_children(id) on delete restrict,
  summary text not null,
  next_steps text not null,
  tags text[] not null default '{}',
  attention_points text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_follow_ups_teacher_profile_id on booking_follow_ups(teacher_profile_id);
create index if not exists idx_booking_follow_ups_child_id on booking_follow_ups(child_id);

create or replace function validate_booking_child_parent_match()
returns trigger
language plpgsql
as $$
declare
  resolved_parent_profile_id uuid;
begin
  select profile_id
  into resolved_parent_profile_id
  from parent_children
  where id = new.child_id;

  if resolved_parent_profile_id is null then
    raise exception 'child_id does not exist in parent_children';
  end if;

  if resolved_parent_profile_id <> new.parent_profile_id then
    raise exception 'child_id does not belong to parent_profile_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_booking_child_parent_match on bookings;
create trigger trg_validate_booking_child_parent_match
before insert or update of parent_profile_id, child_id
on bookings
for each row
execute function validate_booking_child_parent_match();
