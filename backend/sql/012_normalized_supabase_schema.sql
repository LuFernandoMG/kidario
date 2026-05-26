-- Kidario normalized Supabase schema migration.
--
-- Apply after 011_add_parent_cpf.sql.
--
-- This is intentionally transitional: it creates the normalized model requested
-- for users, parents, teachers, children, packages, payments and notifications,
-- backfills it from the current production tables, and keeps compatibility
-- columns/triggers so the existing backend can keep writing while services are
-- moved domain by domain to the normalized tables.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.kidario_legacy_uuid(scope text, legacy_id uuid)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5(scope || ':' || legacy_id::text), 1, 8) || '-' ||
    substr(md5(scope || ':' || legacy_id::text), 9, 4) || '-' ||
    substr(md5(scope || ':' || legacy_id::text), 13, 4) || '-' ||
    substr(md5(scope || ':' || legacy_id::text), 17, 4) || '-' ||
    substr(md5(scope || ':' || legacy_id::text), 21, 12)
  )::uuid;
$$;

-- ---------------------------------------------------------------------------
-- 1. Normalized profile domain
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  role text not null check (role in ('parent', 'teacher')),
  auth_email_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  street text not null,
  number text,
  complement text,
  district text not null,
  city text not null,
  state text not null,
  postal_code text,
  country text not null default 'BR',
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  address_id uuid not null references public.addresses(id) on delete restrict,
  phone text not null,
  birth_date date not null,
  cpf text not null unique,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  address_id uuid not null references public.addresses(id) on delete restrict,
  phone text,
  cpf text not null unique,
  professional_number text,
  modality text check (modality is null or modality in ('online', 'presencial', 'ambos')),
  biography text,
  hourly_rate_cents integer check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  lesson_duration_minutes integer check (
    lesson_duration_minutes is null
    or (lesson_duration_minutes >= 15 and lesson_duration_minutes <= 300)
  ),
  profile_photo_file_name text,
  hide_experience boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  name text not null,
  gender text check (
    gender is null or gender in ('girl', 'boy', 'other', 'prefer not to disclose')
  ),
  birth_month_year date check (
    birth_month_year is null or date_part('day', birth_month_year) = 1
  ),
  current_grade text,
  school text,
  focus_points text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_parent_id_id_unique unique (parent_id, id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'children_parent_id_id_unique'
      and conrelid = 'public.children'::regclass
  ) then
    alter table public.children
      add constraint children_parent_id_id_unique unique (parent_id, id);
  end if;
end
$$;

create table if not exists public.teacher_academic_records (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  degree_type text not null,
  course_name text not null,
  institution text not null,
  completion_year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_skills (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  skill text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_skills_teacher_skill_unique unique (teacher_id, skill)
);

-- Existing tables with names kept from the legacy model.
alter table if exists public.teacher_availability
  add column if not exists teacher_id uuid;

alter table if exists public.teacher_experiences
  add column if not exists teacher_id uuid,
  add column if not exists description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'teacher_availability_teacher_id_fkey'
      and conrelid = 'public.teacher_availability'::regclass
  ) then
    alter table public.teacher_availability
      add constraint teacher_availability_teacher_id_fkey
      foreign key (teacher_id)
      references public.teachers(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'teacher_experiences_teacher_id_fkey'
      and conrelid = 'public.teacher_experiences'::regclass
  ) then
    alter table public.teacher_experiences
      add constraint teacher_experiences_teacher_id_fkey
      foreign key (teacher_id)
      references public.teachers(id)
      on delete cascade
      not valid;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Packages and booking/payment domain
-- ---------------------------------------------------------------------------

alter table if exists public.bookings
  add column if not exists parent_id uuid,
  add column if not exists teacher_id uuid,
  add column if not exists package_id uuid,
  add column if not exists starts_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists canceled_at timestamptz;

create table if not exists public.package_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  sessions_count integer not null check (sessions_count > 0),
  discount_percent numeric(5,2) not null default 0 check (
    discount_percent >= 0 and discount_percent <= 100
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint package_plans_teacher_code_unique unique (teacher_id, code),
  constraint package_plans_id_teacher_unique unique (id, teacher_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'package_plans_teacher_code_unique'
      and conrelid = 'public.package_plans'::regclass
  ) then
    alter table public.package_plans
      add constraint package_plans_teacher_code_unique unique (teacher_id, code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'package_plans_id_teacher_unique'
      and conrelid = 'public.package_plans'::regclass
  ) then
    alter table public.package_plans
      add constraint package_plans_id_teacher_unique unique (id, teacher_id);
  end if;
end
$$;

create table if not exists public.booking_packages (
  id uuid primary key default gen_random_uuid(),
  package_plan_id uuid not null,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  parent_id uuid not null references public.parents(id) on delete restrict,
  child_id uuid not null references public.children(id) on delete restrict,
  total_sessions integer not null check (total_sessions > 0),
  original_unit_amount_cents integer not null check (original_unit_amount_cents >= 0),
  original_amount_cents integer not null check (original_amount_cents >= 0),
  discount_percent numeric(5,2) not null default 0 check (
    discount_percent >= 0 and discount_percent <= 100
  ),
  discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  final_amount_cents integer not null check (final_amount_cents >= 0),
  currency text not null default 'BRL',
  status text not null check (
    status in ('pending_payment', 'active', 'completed', 'canceled', 'expired')
  ),
  valid_from timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_packages_plan_teacher_fkey
    foreign key (package_plan_id, teacher_id)
    references public.package_plans(id, teacher_id)
    on delete restrict,
  constraint booking_packages_parent_child_fkey
    foreign key (parent_id, child_id)
    references public.children(parent_id, id)
    on delete restrict,
  constraint booking_packages_id_teacher_unique unique (id, teacher_id),
  constraint booking_packages_id_parent_unique unique (id, parent_id),
  constraint booking_packages_id_parent_teacher_child_unique
    unique (id, parent_id, teacher_id, child_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_packages_id_teacher_unique'
      and conrelid = 'public.booking_packages'::regclass
  ) then
    alter table public.booking_packages
      add constraint booking_packages_id_teacher_unique unique (id, teacher_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_packages_id_parent_unique'
      and conrelid = 'public.booking_packages'::regclass
  ) then
    alter table public.booking_packages
      add constraint booking_packages_id_parent_unique unique (id, parent_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_packages_id_parent_teacher_child_unique'
      and conrelid = 'public.booking_packages'::regclass
  ) then
    alter table public.booking_packages
      add constraint booking_packages_id_parent_teacher_child_unique
      unique (id, parent_id, teacher_id, child_id);
  end if;
end
$$;

create unique index if not exists idx_bookings_id_parent_unique
  on public.bookings(id, parent_id);

create unique index if not exists idx_bookings_id_parent_teacher_child_unique
  on public.bookings(id, parent_id, teacher_id, child_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_parent_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_parent_id_fkey
      foreign key (parent_id)
      references public.parents(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_teacher_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_teacher_id_fkey
      foreign key (teacher_id)
      references public.teachers(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_parent_child_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_parent_child_fkey
      foreign key (parent_id, child_id)
      references public.children(parent_id, id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_package_parent_teacher_child_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_package_parent_teacher_child_fkey
      foreign key (package_id, parent_id, teacher_id, child_id)
      references public.booking_packages(id, parent_id, teacher_id, child_id)
      on delete restrict
      not valid;
  end if;
end
$$;

create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text check (
    comment is null
    or char_length(trim(comment)) between 1 and 2000
  ),
  feedback jsonb not null default '{}'::jsonb check (jsonb_typeof(feedback) = 'object'),
  is_public boolean not null default true,
  status text not null default 'published' check (
    status in ('published', 'hidden', 'reported', 'removed')
  ),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_provider_customers (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  provider text not null default 'pagarme',
  provider_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_provider_customers_provider_customer_unique
    unique (provider, provider_customer_id),
  constraint payment_provider_customers_parent_provider_unique
    unique (parent_id, provider)
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete restrict,
  booking_id uuid,
  package_id uuid,
  payment_provider_customer_id uuid references public.payment_provider_customers(id) on delete set null,
  provider text not null default 'pagarme',
  provider_order_id text unique,
  provider_order_code text unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  status text not null check (
    status in (
      'created',
      'pending',
      'paid',
      'payment_failed',
      'canceled',
      'refunded',
      'partially_refunded'
    )
  ),
  idempotency_key text unique,
  billing_address_snapshot jsonb,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_orders_target_check
    check (num_nonnulls(booking_id, package_id) = 1),
  constraint payment_orders_booking_parent_fkey
    foreign key (booking_id, parent_id)
    references public.bookings(id, parent_id)
    on delete restrict,
  constraint payment_orders_package_parent_fkey
    foreign key (package_id, parent_id)
    references public.booking_packages(id, parent_id)
    on delete restrict
);

create table if not exists public.payment_charges (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  provider text not null default 'pagarme',
  provider_charge_id text unique,
  provider_transaction_id text,
  payment_method text not null check (payment_method in ('credit_card', 'pix', 'boleto')),
  status text not null check (
    status in (
      'pending',
      'processing',
      'paid',
      'payment_failed',
      'failed',
      'canceled',
      'refunded',
      'chargedback'
    )
  ),
  amount_cents integer not null check (amount_cents >= 0),
  paid_amount_cents integer check (paid_amount_cents is null or paid_amount_cents >= 0),
  installments integer not null default 1 check (installments > 0),
  pix_qr_code text,
  pix_qr_code_url text,
  pix_expires_at timestamptz,
  boleto_url text,
  boleto_expires_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  payment_charge_id uuid references public.payment_charges(id) on delete set null,
  provider text not null default 'pagarme',
  provider_refund_id text unique,
  amount_cents integer not null check (amount_cents > 0),
  reason text,
  status text not null check (
    status in ('requested', 'processing', 'succeeded', 'failed', 'canceled')
  ),
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pagarme',
  event_type text not null,
  provider_event_id text,
  provider_order_id text,
  provider_charge_id text,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  payment_charge_id uuid references public.payment_charges(id) on delete set null,
  payload jsonb not null,
  processing_status text not null default 'received' check (
    processing_status in ('received', 'processed', 'failed', 'ignored')
  ),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

-- ---------------------------------------------------------------------------
-- 3. Chat and notifications
-- ---------------------------------------------------------------------------

alter table if exists public.chat_threads
  add column if not exists parent_id uuid,
  add column if not exists teacher_id uuid,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'archived', 'blocked'));

alter table if exists public.chat_messages
  add column if not exists sender_user_id uuid,
  add column if not exists booking_id uuid,
  add column if not exists package_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_threads_parent_id_fkey'
      and conrelid = 'public.chat_threads'::regclass
  ) then
    alter table public.chat_threads
      add constraint chat_threads_parent_id_fkey
      foreign key (parent_id)
      references public.parents(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_threads_teacher_id_fkey'
      and conrelid = 'public.chat_threads'::regclass
  ) then
    alter table public.chat_threads
      add constraint chat_threads_teacher_id_fkey
      foreign key (teacher_id)
      references public.teachers(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_sender_user_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_sender_user_id_fkey
      foreign key (sender_user_id)
      references public.users(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_context_check'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_context_check
      check (num_nonnulls(booking_id, package_id) <= 1)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_booking_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_booking_id_fkey
      foreign key (booking_id)
      references public.bookings(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_package_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_package_id_fkey
      foreign key (package_id)
      references public.booking_packages(id)
      on delete set null
      not valid;
  end if;
end
$$;

create table if not exists public.notification_device_types (
  id smallserial primary key,
  code text not null unique check (code in ('ios', 'android', 'web')),
  name text not null
);

create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  device_type_id smallint not null references public.notification_device_types(id) on delete restrict,
  provider text not null check (provider in ('firebase', 'expo', 'apns')),
  push_token text not null unique,
  app_version text,
  locale text,
  timezone text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('push', 'email', 'sms')),
  notification_type text not null check (
    notification_type in (
      'booking_created',
      'booking_confirmed',
      'booking_canceled',
      'booking_reminder',
      'payment_paid',
      'payment_failed',
      'package_activated',
      'package_low_credits',
      'chat_message'
    )
  ),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_user_channel_type_unique
    unique (user_id, channel, notification_type)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null,
  channel text not null check (channel in ('push', 'email', 'sms')),
  title text,
  body text,
  payload jsonb,
  status text not null default 'queued' check (
    status in ('queued', 'sent', 'failed', 'read')
  ),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  device_id uuid references public.notification_devices(id) on delete set null,
  provider text check (provider is null or provider in ('firebase', 'expo', 'apns')),
  provider_message_id text,
  status text not null check (status in ('queued', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

insert into public.notification_device_types (code, name)
values
  ('ios', 'iOS'),
  ('android', 'Android'),
  ('web', 'Web')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Backfill normalized rows from the legacy schema
-- ---------------------------------------------------------------------------

insert into public.users (
  id,
  email,
  first_name,
  last_name,
  role,
  auth_email_confirmed,
  created_at,
  updated_at
)
select
  p.id,
  p.email,
  coalesce(nullif(trim(p.first_name), ''), 'Nome') as first_name,
  coalesce(nullif(trim(p.last_name), ''), 'Nao informado') as last_name,
  p.role,
  p.auth_email_confirmed,
  p.created_at,
  p.updated_at
from public.profiles p
on conflict (id) do update
set
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  role = excluded.role,
  auth_email_confirmed = excluded.auth_email_confirmed,
  updated_at = excluded.updated_at;

insert into public.addresses (
  id,
  street,
  district,
  city,
  state,
  country,
  created_at,
  updated_at
)
select
  public.kidario_legacy_uuid('parent-address', pp.profile_id),
  coalesce(nullif(trim(pp.address), ''), 'Nao informado'),
  'Nao informado',
  'Nao informado',
  'NA',
  'BR',
  pp.created_at,
  pp.updated_at
from public.parent_profiles pp
on conflict (id) do update
set
  street = excluded.street,
  updated_at = excluded.updated_at;

with parent_profile_source as (
  select
    pp.*,
    nullif(trim(pp.cpf), '') as normalized_cpf,
    count(*) over (partition by nullif(trim(pp.cpf), '')) as normalized_cpf_count
  from public.parent_profiles pp
)
insert into public.parents (
  id,
  user_id,
  address_id,
  phone,
  birth_date,
  cpf,
  bio,
  created_at,
  updated_at
)
select
  public.kidario_legacy_uuid('parent', source.profile_id),
  source.profile_id,
  public.kidario_legacy_uuid('parent-address', source.profile_id),
  coalesce(nullif(trim(source.phone), ''), 'Nao informado'),
  coalesce(source.birth_date, date '1900-01-01'),
  case
    when source.normalized_cpf is null then 'missing-parent-cpf-' || source.profile_id::text
    when source.normalized_cpf_count > 1 then 'duplicate-parent-cpf-' || source.profile_id::text
    else source.normalized_cpf
  end,
  source.bio,
  source.created_at,
  source.updated_at
from parent_profile_source source
on conflict (user_id) do update
set
  address_id = excluded.address_id,
  phone = excluded.phone,
  birth_date = excluded.birth_date,
  cpf = excluded.cpf,
  bio = excluded.bio,
  updated_at = excluded.updated_at;

insert into public.addresses (
  id,
  street,
  district,
  city,
  state,
  country,
  created_at,
  updated_at
)
select
  public.kidario_legacy_uuid('teacher-address', tp.profile_id),
  'Nao informado',
  'Nao informado',
  coalesce(nullif(trim(tp.city), ''), 'Nao informado'),
  coalesce(nullif(trim(tp.state), ''), 'NA'),
  'BR',
  tp.created_at,
  tp.updated_at
from public.teacher_profiles tp
on conflict (id) do update
set
  city = excluded.city,
  state = excluded.state,
  updated_at = excluded.updated_at;

with teacher_profile_source as (
  select
    tp.*,
    nullif(trim(tp.cpf), '') as normalized_cpf,
    count(*) over (partition by nullif(trim(tp.cpf), '')) as normalized_cpf_count
  from public.teacher_profiles tp
)
insert into public.teachers (
  id,
  user_id,
  address_id,
  phone,
  cpf,
  professional_number,
  modality,
  biography,
  hourly_rate_cents,
  lesson_duration_minutes,
  profile_photo_file_name,
  hide_experience,
  is_active,
  created_at,
  updated_at
)
select
  public.kidario_legacy_uuid('teacher', source.profile_id),
  source.profile_id,
  public.kidario_legacy_uuid('teacher-address', source.profile_id),
  source.phone,
  case
    when source.normalized_cpf is null then 'missing-teacher-cpf-' || source.profile_id::text
    when source.normalized_cpf_count > 1 then 'duplicate-teacher-cpf-' || source.profile_id::text
    else source.normalized_cpf
  end,
  source.professional_registration,
  case
    when lower(coalesce(source.modality, '')) in ('hibrido', 'ambos') then 'ambos'
    when lower(coalesce(source.modality, '')) = 'presencial' then 'presencial'
    when lower(coalesce(source.modality, '')) = 'online' then 'online'
    else null
  end,
  source.mini_bio,
  case
    when source.hourly_rate is null then null
    else greatest(round(source.hourly_rate * 100), 0)::integer
  end,
  source.lesson_duration_minutes,
  source.profile_photo_file_name,
  source.request_experience_anonymity,
  source.is_active_teacher,
  source.created_at,
  source.updated_at
from teacher_profile_source source
on conflict (user_id) do update
set
  address_id = excluded.address_id,
  phone = excluded.phone,
  cpf = excluded.cpf,
  professional_number = excluded.professional_number,
  modality = excluded.modality,
  biography = excluded.biography,
  hourly_rate_cents = excluded.hourly_rate_cents,
  lesson_duration_minutes = excluded.lesson_duration_minutes,
  profile_photo_file_name = excluded.profile_photo_file_name,
  hide_experience = excluded.hide_experience,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;

insert into public.children (
  id,
  parent_id,
  name,
  gender,
  birth_month_year,
  current_grade,
  school,
  focus_points,
  created_at,
  updated_at
)
select
  pc.id,
  p.id,
  pc.name,
  pc.gender,
  case
    when pc.birth_month_year ~ '^[0-9]{4}-[0-9]{2}$'
      then (pc.birth_month_year || '-01')::date
    else null
  end,
  pc.current_grade,
  pc.school,
  pc.focus_points,
  pc.created_at,
  pc.updated_at
from public.parent_children pc
join public.parents p on p.user_id = pc.profile_id
on conflict (id) do update
set
  parent_id = excluded.parent_id,
  name = excluded.name,
  gender = excluded.gender,
  birth_month_year = excluded.birth_month_year,
  current_grade = excluded.current_grade,
  school = excluded.school,
  focus_points = excluded.focus_points,
  updated_at = excluded.updated_at;

update public.teacher_availability ta
set teacher_id = t.id
from public.teachers t
where t.user_id = ta.profile_id
  and ta.teacher_id is distinct from t.id;

update public.teacher_experiences te
set
  teacher_id = t.id,
  description = coalesce(nullif(te.description, ''), te.responsibilities)
from public.teachers t
where t.user_id = te.profile_id
  and (
    te.teacher_id is distinct from t.id
    or te.description is distinct from coalesce(nullif(te.description, ''), te.responsibilities)
  );

insert into public.teacher_academic_records (
  id,
  teacher_id,
  degree_type,
  course_name,
  institution,
  completion_year,
  created_at,
  updated_at
)
select
  tf.id,
  t.id,
  tf.degree_type,
  tf.course_name,
  tf.institution,
  tf.completion_year,
  tf.created_at,
  tf.updated_at
from public.teacher_formations tf
join public.teachers t on t.user_id = tf.profile_id
on conflict (id) do update
set
  teacher_id = excluded.teacher_id,
  degree_type = excluded.degree_type,
  course_name = excluded.course_name,
  institution = excluded.institution,
  completion_year = excluded.completion_year,
  updated_at = excluded.updated_at;

insert into public.teacher_skills (
  id,
  teacher_id,
  skill,
  created_at,
  updated_at
)
select
  ts.id,
  t.id,
  ts.specialty,
  ts.created_at,
  ts.updated_at
from public.teacher_specialties ts
join public.teachers t on t.user_id = ts.profile_id
on conflict (id) do update
set
  teacher_id = excluded.teacher_id,
  skill = excluded.skill,
  updated_at = excluded.updated_at;

update public.bookings b
set
  parent_id = p.id,
  teacher_id = t.id,
  starts_at = case
    when b.time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then ((b.date_iso::text || ' ' || b.time)::timestamp at time zone 'America/Sao_Paulo')
    else (b.date_iso::timestamp at time zone 'America/Sao_Paulo')
  end,
  confirmed_at = case
    when b.status in ('confirmada', 'concluida') then coalesce(b.confirmed_at, b.updated_at)
    else b.confirmed_at
  end,
  completed_at = case when b.status = 'concluida' then coalesce(b.completed_at, b.updated_at) else b.completed_at end,
  canceled_at = case when b.status = 'cancelada' then coalesce(b.canceled_at, b.updated_at) else b.canceled_at end
from public.parents p
join public.teachers t on true
where p.user_id = b.parent_profile_id
  and t.user_id = b.teacher_profile_id
  and (
    b.parent_id is distinct from p.id
    or b.teacher_id is distinct from t.id
    or b.starts_at is distinct from case
      when b.time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        then ((b.date_iso::text || ' ' || b.time)::timestamp at time zone 'America/Sao_Paulo')
      else (b.date_iso::timestamp at time zone 'America/Sao_Paulo')
    end
    or (b.status in ('confirmada', 'concluida') and b.confirmed_at is null)
    or (b.status = 'concluida' and b.completed_at is null)
    or (b.status = 'cancelada' and b.canceled_at is null)
  );

insert into public.payment_orders (
  id,
  parent_id,
  booking_id,
  provider,
  amount_cents,
  currency,
  status,
  created_at,
  updated_at
)
select
  public.kidario_legacy_uuid('booking-payment-order', b.id),
  b.parent_id,
  b.id,
  'legacy',
  greatest(round(coalesce(b.price_total, 0) * 100), 0)::integer,
  coalesce(b.currency, 'BRL'),
  case
    when b.payment_status = 'pago' then 'paid'
    when b.payment_status = 'falhou' then 'payment_failed'
    else 'pending'
  end,
  b.created_at,
  b.updated_at
from public.bookings b
where b.parent_id is not null
on conflict (id) do update
set
  parent_id = excluded.parent_id,
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into public.payment_charges (
  id,
  payment_order_id,
  provider,
  payment_method,
  status,
  amount_cents,
  paid_amount_cents,
  paid_at,
  failed_at,
  created_at,
  updated_at
)
select
  public.kidario_legacy_uuid('booking-payment-charge', b.id),
  public.kidario_legacy_uuid('booking-payment-order', b.id),
  'legacy',
  case when b.payment_method = 'cartao' then 'credit_card' else 'pix' end,
  case
    when b.payment_status = 'pago' then 'paid'
    when b.payment_status = 'falhou' then 'payment_failed'
    else 'pending'
  end,
  greatest(round(coalesce(b.price_total, 0) * 100), 0)::integer,
  case
    when b.payment_status = 'pago' then greatest(round(coalesce(b.price_total, 0) * 100), 0)::integer
    else null
  end,
  case when b.payment_status = 'pago' then b.updated_at else null end,
  case when b.payment_status = 'falhou' then b.updated_at else null end,
  b.created_at,
  b.updated_at
from public.bookings b
where b.parent_id is not null
on conflict (id) do update
set
  payment_method = excluded.payment_method,
  status = excluded.status,
  amount_cents = excluded.amount_cents,
  paid_amount_cents = excluded.paid_amount_cents,
  paid_at = excluded.paid_at,
  failed_at = excluded.failed_at,
  updated_at = excluded.updated_at;

update public.chat_threads ct
set
  parent_id = p.id,
  teacher_id = t.id
from public.parents p
join public.teachers t on true
where p.user_id = ct.parent_profile_id
  and t.user_id = ct.teacher_profile_id
  and (
    ct.parent_id is distinct from p.id
    or ct.teacher_id is distinct from t.id
  );

update public.chat_messages cm
set sender_user_id = cm.sender_profile_id
where cm.sender_user_id is distinct from cm.sender_profile_id;

-- ---------------------------------------------------------------------------
-- 5. Sync triggers for writes still using the legacy contract
-- ---------------------------------------------------------------------------

create or replace function public.sync_user_from_profile()
returns trigger
language plpgsql
as $$
begin
  insert into public.users (
    id,
    email,
    first_name,
    last_name,
    role,
    auth_email_confirmed,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.first_name), ''), 'Nome'),
    coalesce(nullif(trim(new.last_name), ''), 'Nao informado'),
    new.role,
    new.auth_email_confirmed,
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    auth_email_confirmed = excluded.auth_email_confirmed,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_user_from_profile on public.profiles;
create trigger trg_sync_user_from_profile
after insert or update on public.profiles
for each row execute function public.sync_user_from_profile();

create or replace function public.sync_parent_from_parent_profile()
returns trigger
language plpgsql
as $$
declare
  normalized_address_id uuid;
  normalized_parent_id uuid;
begin
  normalized_address_id := public.kidario_legacy_uuid('parent-address', new.profile_id);
  normalized_parent_id := public.kidario_legacy_uuid('parent', new.profile_id);

  insert into public.addresses (
    id,
    street,
    district,
    city,
    state,
    country,
    created_at,
    updated_at
  )
  values (
    normalized_address_id,
    coalesce(nullif(trim(new.address), ''), 'Nao informado'),
    'Nao informado',
    'Nao informado',
    'NA',
    'BR',
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    street = excluded.street,
    updated_at = excluded.updated_at;

  insert into public.parents (
    id,
    user_id,
    address_id,
    phone,
    birth_date,
    cpf,
    bio,
    created_at,
    updated_at
  )
  values (
    normalized_parent_id,
    new.profile_id,
    normalized_address_id,
    coalesce(nullif(trim(new.phone), ''), 'Nao informado'),
    coalesce(new.birth_date, date '1900-01-01'),
    coalesce(nullif(trim(new.cpf), ''), 'missing-parent-cpf-' || new.profile_id::text),
    new.bio,
    new.created_at,
    new.updated_at
  )
  on conflict (user_id) do update
  set
    address_id = excluded.address_id,
    phone = excluded.phone,
    birth_date = excluded.birth_date,
    cpf = excluded.cpf,
    bio = excluded.bio,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_parent_from_parent_profile on public.parent_profiles;
create trigger trg_sync_parent_from_parent_profile
after insert or update on public.parent_profiles
for each row execute function public.sync_parent_from_parent_profile();

create or replace function public.sync_teacher_from_teacher_profile()
returns trigger
language plpgsql
as $$
declare
  normalized_address_id uuid;
  normalized_teacher_id uuid;
begin
  normalized_address_id := public.kidario_legacy_uuid('teacher-address', new.profile_id);
  normalized_teacher_id := public.kidario_legacy_uuid('teacher', new.profile_id);

  insert into public.addresses (
    id,
    street,
    district,
    city,
    state,
    country,
    created_at,
    updated_at
  )
  values (
    normalized_address_id,
    'Nao informado',
    'Nao informado',
    coalesce(nullif(trim(new.city), ''), 'Nao informado'),
    coalesce(nullif(trim(new.state), ''), 'NA'),
    'BR',
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    city = excluded.city,
    state = excluded.state,
    updated_at = excluded.updated_at;

  insert into public.teachers (
    id,
    user_id,
    address_id,
    phone,
    cpf,
    professional_number,
    modality,
    biography,
    hourly_rate_cents,
    lesson_duration_minutes,
    profile_photo_file_name,
    hide_experience,
    is_active,
    created_at,
    updated_at
  )
  values (
    normalized_teacher_id,
    new.profile_id,
    normalized_address_id,
    new.phone,
    coalesce(nullif(trim(new.cpf), ''), 'missing-teacher-cpf-' || new.profile_id::text),
    new.professional_registration,
    case
      when lower(coalesce(new.modality, '')) in ('hibrido', 'ambos') then 'ambos'
      when lower(coalesce(new.modality, '')) = 'presencial' then 'presencial'
      when lower(coalesce(new.modality, '')) = 'online' then 'online'
      else null
    end,
    new.mini_bio,
    case
      when new.hourly_rate is null then null
      else greatest(round(new.hourly_rate * 100), 0)::integer
    end,
    new.lesson_duration_minutes,
    new.profile_photo_file_name,
    new.request_experience_anonymity,
    new.is_active_teacher,
    new.created_at,
    new.updated_at
  )
  on conflict (user_id) do update
  set
    address_id = excluded.address_id,
    phone = excluded.phone,
    cpf = excluded.cpf,
    professional_number = excluded.professional_number,
    modality = excluded.modality,
    biography = excluded.biography,
    hourly_rate_cents = excluded.hourly_rate_cents,
    lesson_duration_minutes = excluded.lesson_duration_minutes,
    profile_photo_file_name = excluded.profile_photo_file_name,
    hide_experience = excluded.hide_experience,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_teacher_from_teacher_profile on public.teacher_profiles;
create trigger trg_sync_teacher_from_teacher_profile
after insert or update on public.teacher_profiles
for each row execute function public.sync_teacher_from_teacher_profile();

create or replace function public.sync_child_from_parent_child()
returns trigger
language plpgsql
as $$
declare
  normalized_parent_id uuid;
begin
  select p.id
  into normalized_parent_id
  from public.parents p
  where p.user_id = new.profile_id;

  if normalized_parent_id is null then
    return new;
  end if;

  insert into public.children (
    id,
    parent_id,
    name,
    gender,
    birth_month_year,
    current_grade,
    school,
    focus_points,
    created_at,
    updated_at
  )
  values (
    new.id,
    normalized_parent_id,
    new.name,
    new.gender,
    case
      when new.birth_month_year ~ '^[0-9]{4}-[0-9]{2}$'
        then (new.birth_month_year || '-01')::date
      else null
    end,
    new.current_grade,
    new.school,
    new.focus_points,
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    parent_id = excluded.parent_id,
    name = excluded.name,
    gender = excluded.gender,
    birth_month_year = excluded.birth_month_year,
    current_grade = excluded.current_grade,
    school = excluded.school,
    focus_points = excluded.focus_points,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_child_from_parent_child on public.parent_children;
create trigger trg_sync_child_from_parent_child
after insert or update on public.parent_children
for each row execute function public.sync_child_from_parent_child();

create or replace function public.delete_child_from_parent_child()
returns trigger
language plpgsql
as $$
begin
  delete from public.children where id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_delete_child_from_parent_child on public.parent_children;
create trigger trg_delete_child_from_parent_child
after delete on public.parent_children
for each row execute function public.delete_child_from_parent_child();

create or replace function public.sync_teacher_availability_normalized_fields()
returns trigger
language plpgsql
as $$
begin
  if new.teacher_id is null then
    select t.id
    into new.teacher_id
    from public.teachers t
    where t.user_id = new.profile_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_teacher_availability_normalized_fields on public.teacher_availability;
create trigger trg_sync_teacher_availability_normalized_fields
before insert or update on public.teacher_availability
for each row execute function public.sync_teacher_availability_normalized_fields();

create or replace function public.sync_teacher_experience_normalized_fields()
returns trigger
language plpgsql
as $$
begin
  if new.teacher_id is null then
    select t.id
    into new.teacher_id
    from public.teachers t
    where t.user_id = new.profile_id;
  end if;

  new.description := coalesce(nullif(new.description, ''), new.responsibilities);
  return new;
end;
$$;

drop trigger if exists trg_sync_teacher_experience_normalized_fields on public.teacher_experiences;
create trigger trg_sync_teacher_experience_normalized_fields
before insert or update on public.teacher_experiences
for each row execute function public.sync_teacher_experience_normalized_fields();

create or replace function public.sync_teacher_academic_record_from_formation()
returns trigger
language plpgsql
as $$
declare
  normalized_teacher_id uuid;
begin
  select t.id
  into normalized_teacher_id
  from public.teachers t
  where t.user_id = new.profile_id;

  if normalized_teacher_id is null then
    return new;
  end if;

  insert into public.teacher_academic_records (
    id,
    teacher_id,
    degree_type,
    course_name,
    institution,
    completion_year,
    created_at,
    updated_at
  )
  values (
    new.id,
    normalized_teacher_id,
    new.degree_type,
    new.course_name,
    new.institution,
    new.completion_year,
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    teacher_id = excluded.teacher_id,
    degree_type = excluded.degree_type,
    course_name = excluded.course_name,
    institution = excluded.institution,
    completion_year = excluded.completion_year,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_teacher_academic_record_from_formation on public.teacher_formations;
create trigger trg_sync_teacher_academic_record_from_formation
after insert or update on public.teacher_formations
for each row execute function public.sync_teacher_academic_record_from_formation();

create or replace function public.delete_teacher_academic_record_from_formation()
returns trigger
language plpgsql
as $$
begin
  delete from public.teacher_academic_records where id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_delete_teacher_academic_record_from_formation on public.teacher_formations;
create trigger trg_delete_teacher_academic_record_from_formation
after delete on public.teacher_formations
for each row execute function public.delete_teacher_academic_record_from_formation();

create or replace function public.sync_teacher_skill_from_specialty()
returns trigger
language plpgsql
as $$
declare
  normalized_teacher_id uuid;
begin
  select t.id
  into normalized_teacher_id
  from public.teachers t
  where t.user_id = new.profile_id;

  if normalized_teacher_id is null then
    return new;
  end if;

  insert into public.teacher_skills (
    id,
    teacher_id,
    skill,
    created_at,
    updated_at
  )
  values (
    new.id,
    normalized_teacher_id,
    new.specialty,
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    teacher_id = excluded.teacher_id,
    skill = excluded.skill,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_teacher_skill_from_specialty on public.teacher_specialties;
create trigger trg_sync_teacher_skill_from_specialty
after insert or update on public.teacher_specialties
for each row execute function public.sync_teacher_skill_from_specialty();

create or replace function public.delete_teacher_skill_from_specialty()
returns trigger
language plpgsql
as $$
begin
  delete from public.teacher_skills where id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_delete_teacher_skill_from_specialty on public.teacher_specialties;
create trigger trg_delete_teacher_skill_from_specialty
after delete on public.teacher_specialties
for each row execute function public.delete_teacher_skill_from_specialty();

create or replace function public.sync_booking_normalized_fields()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    select p.id
    into new.parent_id
    from public.parents p
    where p.user_id = new.parent_profile_id;
  end if;

  if new.teacher_id is null then
    select t.id
    into new.teacher_id
    from public.teachers t
    where t.user_id = new.teacher_profile_id;
  end if;

  if new.starts_at is null then
    new.starts_at := case
      when new.time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        then ((new.date_iso::text || ' ' || new.time)::timestamp at time zone 'America/Sao_Paulo')
      else (new.date_iso::timestamp at time zone 'America/Sao_Paulo')
    end;
  end if;

  if new.status in ('confirmada', 'concluida') and new.confirmed_at is null then
    new.confirmed_at := now();
  end if;

  if new.status = 'concluida' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status = 'cancelada' and new.canceled_at is null then
    new.canceled_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_booking_normalized_fields on public.bookings;
create trigger trg_sync_booking_normalized_fields
before insert or update on public.bookings
for each row execute function public.sync_booking_normalized_fields();

create or replace function public.sync_payment_from_booking()
returns trigger
language plpgsql
as $$
declare
  normalized_order_id uuid;
  normalized_charge_id uuid;
  normalized_amount_cents integer;
  normalized_payment_status text;
begin
  if new.parent_id is null then
    return new;
  end if;

  normalized_order_id := public.kidario_legacy_uuid('booking-payment-order', new.id);
  normalized_charge_id := public.kidario_legacy_uuid('booking-payment-charge', new.id);
  normalized_amount_cents := greatest(round(coalesce(new.price_total, 0) * 100), 0)::integer;
  normalized_payment_status := case
    when new.payment_status = 'pago' then 'paid'
    when new.payment_status = 'falhou' then 'payment_failed'
    else 'pending'
  end;

  insert into public.payment_orders (
    id,
    parent_id,
    booking_id,
    provider,
    amount_cents,
    currency,
    status,
    created_at,
    updated_at
  )
  values (
    normalized_order_id,
    new.parent_id,
    new.id,
    'legacy',
    normalized_amount_cents,
    coalesce(new.currency, 'BRL'),
    normalized_payment_status,
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    parent_id = excluded.parent_id,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    status = excluded.status,
    updated_at = excluded.updated_at;

  insert into public.payment_charges (
    id,
    payment_order_id,
    provider,
    payment_method,
    status,
    amount_cents,
    paid_amount_cents,
    paid_at,
    failed_at,
    created_at,
    updated_at
  )
  values (
    normalized_charge_id,
    normalized_order_id,
    'legacy',
    case when new.payment_method = 'cartao' then 'credit_card' else 'pix' end,
    normalized_payment_status,
    normalized_amount_cents,
    case when new.payment_status = 'pago' then normalized_amount_cents else null end,
    case when new.payment_status = 'pago' then new.updated_at else null end,
    case when new.payment_status = 'falhou' then new.updated_at else null end,
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    payment_method = excluded.payment_method,
    status = excluded.status,
    amount_cents = excluded.amount_cents,
    paid_amount_cents = excluded.paid_amount_cents,
    paid_at = excluded.paid_at,
    failed_at = excluded.failed_at,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_payment_from_booking on public.bookings;
create trigger trg_sync_payment_from_booking
after insert or update on public.bookings
for each row execute function public.sync_payment_from_booking();

create or replace function public.sync_chat_thread_normalized_fields()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    select p.id
    into new.parent_id
    from public.parents p
    where p.user_id = new.parent_profile_id;
  end if;

  if new.teacher_id is null then
    select t.id
    into new.teacher_id
    from public.teachers t
    where t.user_id = new.teacher_profile_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_chat_thread_normalized_fields on public.chat_threads;
create trigger trg_sync_chat_thread_normalized_fields
before insert or update on public.chat_threads
for each row execute function public.sync_chat_thread_normalized_fields();

create or replace function public.sync_chat_message_normalized_fields()
returns trigger
language plpgsql
as $$
begin
  new.sender_user_id := coalesce(new.sender_user_id, new.sender_profile_id);
  return new;
end;
$$;

drop trigger if exists trg_sync_chat_message_normalized_fields on public.chat_messages;
create trigger trg_sync_chat_message_normalized_fields
before insert or update on public.chat_messages
for each row execute function public.sync_chat_message_normalized_fields();

create or replace function public.validate_booking_review()
returns trigger
language plpgsql
as $$
declare
  booking_status text;
begin
  select status
  into booking_status
  from public.bookings
  where id = new.booking_id;

  if booking_status is null then
    raise exception 'Booking not found';
  end if;

  if booking_status <> 'concluida' then
    raise exception 'Only completed bookings can be reviewed';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_booking_review_before_insert on public.booking_reviews;
create trigger validate_booking_review_before_insert
before insert on public.booking_reviews
for each row execute function public.validate_booking_review();

-- ---------------------------------------------------------------------------
-- 6. Recommended indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_children_parent_id
  on public.children(parent_id);

create index if not exists idx_teacher_availability_teacher_day
  on public.teacher_availability(teacher_id, day_of_week);

create index if not exists idx_teacher_experiences_teacher_id
  on public.teacher_experiences(teacher_id);

create index if not exists idx_teacher_academic_records_teacher_id
  on public.teacher_academic_records(teacher_id);

create index if not exists idx_teacher_skills_teacher_id
  on public.teacher_skills(teacher_id);

create index if not exists idx_package_plans_teacher_active
  on public.package_plans(teacher_id, is_active);

create index if not exists idx_booking_packages_parent_child_teacher_status
  on public.booking_packages(parent_id, child_id, teacher_id, status);

create index if not exists idx_booking_packages_plan_id
  on public.booking_packages(package_plan_id);

create index if not exists idx_bookings_teacher_starts_at
  on public.bookings(teacher_id, starts_at);

create index if not exists idx_bookings_parent_child_teacher_starts_at
  on public.bookings(parent_id, child_id, teacher_id, starts_at);

create index if not exists idx_bookings_package_id
  on public.bookings(package_id);

create index if not exists idx_bookings_status_starts_at
  on public.bookings(status, starts_at);

create index if not exists idx_booking_reviews_public_status_submitted_at
  on public.booking_reviews(is_public, status, submitted_at desc);

create index if not exists idx_booking_reviews_rating
  on public.booking_reviews(rating);

create unique index if not exists idx_payment_orders_booking_unique
  on public.payment_orders(booking_id)
  where booking_id is not null;

create unique index if not exists idx_payment_orders_package_unique
  on public.payment_orders(package_id)
  where package_id is not null;

create index if not exists idx_payment_orders_parent_status
  on public.payment_orders(parent_id, status);

create index if not exists idx_payment_charges_order_status
  on public.payment_charges(payment_order_id, status);

create index if not exists idx_payment_charges_provider_charge_id
  on public.payment_charges(provider_charge_id);

create unique index if not exists idx_payment_webhook_events_provider_event_unique
  on public.payment_webhook_events(provider, provider_event_id)
  where provider_event_id is not null;

create index if not exists idx_payment_webhook_events_order_id
  on public.payment_webhook_events(payment_order_id);

create index if not exists idx_chat_threads_parent_id
  on public.chat_threads(parent_id);

create index if not exists idx_chat_threads_teacher_id
  on public.chat_threads(teacher_id);

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'idx_chat_threads_parent_teacher_child_unique'
  ) and not exists (
    select 1
    from public.chat_threads
    where parent_id is not null
      and teacher_id is not null
    group by parent_id, teacher_id, child_id
    having count(*) > 1
  ) then
    create unique index idx_chat_threads_parent_teacher_child_unique
      on public.chat_threads(parent_id, teacher_id, child_id)
      where parent_id is not null
        and teacher_id is not null;
  end if;
end
$$;

create index if not exists idx_notification_devices_user_active
  on public.notification_devices(user_id, is_active);

create index if not exists idx_notification_preferences_user_id
  on public.notification_preferences(user_id);

create index if not exists idx_notifications_user_created_at
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notification_deliveries_notification_id
  on public.notification_deliveries(notification_id);

-- ---------------------------------------------------------------------------
-- 7. updated_at triggers for new normalized tables
-- ---------------------------------------------------------------------------

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_addresses_updated_at on public.addresses;
create trigger set_addresses_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

drop trigger if exists set_parents_updated_at on public.parents;
create trigger set_parents_updated_at
before update on public.parents
for each row execute function public.set_updated_at();

drop trigger if exists set_teachers_updated_at on public.teachers;
create trigger set_teachers_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

drop trigger if exists set_children_updated_at on public.children;
create trigger set_children_updated_at
before update on public.children
for each row execute function public.set_updated_at();

drop trigger if exists set_teacher_academic_records_updated_at on public.teacher_academic_records;
create trigger set_teacher_academic_records_updated_at
before update on public.teacher_academic_records
for each row execute function public.set_updated_at();

drop trigger if exists set_teacher_skills_updated_at on public.teacher_skills;
create trigger set_teacher_skills_updated_at
before update on public.teacher_skills
for each row execute function public.set_updated_at();

drop trigger if exists set_package_plans_updated_at on public.package_plans;
create trigger set_package_plans_updated_at
before update on public.package_plans
for each row execute function public.set_updated_at();

drop trigger if exists set_booking_packages_updated_at on public.booking_packages;
create trigger set_booking_packages_updated_at
before update on public.booking_packages
for each row execute function public.set_updated_at();

drop trigger if exists set_booking_reviews_updated_at on public.booking_reviews;
create trigger set_booking_reviews_updated_at
before update on public.booking_reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_payment_provider_customers_updated_at on public.payment_provider_customers;
create trigger set_payment_provider_customers_updated_at
before update on public.payment_provider_customers
for each row execute function public.set_updated_at();

drop trigger if exists set_payment_orders_updated_at on public.payment_orders;
create trigger set_payment_orders_updated_at
before update on public.payment_orders
for each row execute function public.set_updated_at();

drop trigger if exists set_payment_charges_updated_at on public.payment_charges;
create trigger set_payment_charges_updated_at
before update on public.payment_charges
for each row execute function public.set_updated_at();

drop trigger if exists set_payment_refunds_updated_at on public.payment_refunds;
create trigger set_payment_refunds_updated_at
before update on public.payment_refunds
for each row execute function public.set_updated_at();

drop trigger if exists set_notification_devices_updated_at on public.notification_devices;
create trigger set_notification_devices_updated_at
before update on public.notification_devices
for each row execute function public.set_updated_at();

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. RLS policies for the new normalized tables
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.addresses enable row level security;
alter table public.parents enable row level security;
alter table public.teachers enable row level security;
alter table public.children enable row level security;
alter table public.teacher_academic_records enable row level security;
alter table public.teacher_skills enable row level security;
alter table public.package_plans enable row level security;
alter table public.booking_packages enable row level security;
alter table public.booking_reviews enable row level security;
alter table public.payment_provider_customers enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_charges enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.notification_device_types enable row level security;
alter table public.notification_devices enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists users_service_all on public.users;
create policy users_service_all on public.users
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists users_owner_select on public.users;
create policy users_owner_select on public.users
for select to authenticated
using (id = auth.uid());

drop policy if exists users_owner_insert on public.users;
create policy users_owner_insert on public.users
for insert to authenticated
with check (id = auth.uid() and role in ('parent', 'teacher'));

drop policy if exists users_owner_update on public.users;
create policy users_owner_update on public.users
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role in ('parent', 'teacher'));

drop policy if exists addresses_service_all on public.addresses;
create policy addresses_service_all on public.addresses
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists addresses_owner_select on public.addresses;
create policy addresses_owner_select on public.addresses
for select to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.address_id = addresses.id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.teachers t
    where t.address_id = addresses.id
      and t.user_id = auth.uid()
  )
);

drop policy if exists addresses_owner_update on public.addresses;
create policy addresses_owner_update on public.addresses
for update to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.address_id = addresses.id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.teachers t
    where t.address_id = addresses.id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.parents p
    where p.address_id = addresses.id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.teachers t
    where t.address_id = addresses.id
      and t.user_id = auth.uid()
  )
);

drop policy if exists parents_service_all on public.parents;
create policy parents_service_all on public.parents
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists parents_owner_select on public.parents;
create policy parents_owner_select on public.parents
for select to authenticated
using (user_id = auth.uid());

drop policy if exists parents_owner_insert on public.parents;
create policy parents_owner_insert on public.parents
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists parents_owner_update on public.parents;
create policy parents_owner_update on public.parents
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists teachers_service_all on public.teachers;
create policy teachers_service_all on public.teachers
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists teachers_owner_select on public.teachers;
create policy teachers_owner_select on public.teachers
for select to authenticated
using (user_id = auth.uid() or is_active = true);

drop policy if exists teachers_owner_insert on public.teachers;
create policy teachers_owner_insert on public.teachers
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists teachers_owner_update on public.teachers;
create policy teachers_owner_update on public.teachers
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists children_service_all on public.children;
create policy children_service_all on public.children
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists children_parent_select on public.children;
create policy children_parent_select on public.children
for select to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.id = children.parent_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists children_parent_insert on public.children;
create policy children_parent_insert on public.children
for insert to authenticated
with check (
  exists (
    select 1 from public.parents p
    where p.id = children.parent_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists children_parent_update on public.children;
create policy children_parent_update on public.children
for update to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.id = children.parent_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.parents p
    where p.id = children.parent_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists children_parent_delete on public.children;
create policy children_parent_delete on public.children
for delete to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.id = children.parent_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists teacher_academic_records_service_all on public.teacher_academic_records;
create policy teacher_academic_records_service_all on public.teacher_academic_records
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists teacher_academic_records_teacher_all on public.teacher_academic_records;
create policy teacher_academic_records_teacher_all on public.teacher_academic_records
for all to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.id = teacher_academic_records.teacher_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.teachers t
    where t.id = teacher_academic_records.teacher_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists teacher_skills_service_all on public.teacher_skills;
create policy teacher_skills_service_all on public.teacher_skills
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists teacher_skills_teacher_all on public.teacher_skills;
create policy teacher_skills_teacher_all on public.teacher_skills
for all to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.id = teacher_skills.teacher_id
      and (t.user_id = auth.uid() or t.is_active = true)
  )
)
with check (
  exists (
    select 1 from public.teachers t
    where t.id = teacher_skills.teacher_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists package_plans_service_all on public.package_plans;
create policy package_plans_service_all on public.package_plans
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists package_plans_select on public.package_plans;
create policy package_plans_select on public.package_plans
for select to authenticated
using (
  is_active = true
  or exists (
    select 1 from public.teachers t
    where t.id = package_plans.teacher_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists package_plans_teacher_all on public.package_plans;
create policy package_plans_teacher_all on public.package_plans
for all to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.id = package_plans.teacher_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.teachers t
    where t.id = package_plans.teacher_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists booking_packages_service_all on public.booking_packages;
create policy booking_packages_service_all on public.booking_packages
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists booking_packages_participant_select on public.booking_packages;
create policy booking_packages_participant_select on public.booking_packages
for select to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.id = booking_packages.parent_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.teachers t
    where t.id = booking_packages.teacher_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists booking_reviews_service_all on public.booking_reviews;
create policy booking_reviews_service_all on public.booking_reviews
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists booking_reviews_public_select on public.booking_reviews;
create policy booking_reviews_public_select on public.booking_reviews
for select to authenticated
using (is_public = true and status = 'published');

drop policy if exists booking_reviews_participant_select on public.booking_reviews;
create policy booking_reviews_participant_select on public.booking_reviews
for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.parents p on p.id = b.parent_id
    where b.id = booking_reviews.booking_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.teachers t on t.id = b.teacher_id
    where b.id = booking_reviews.booking_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists booking_reviews_parent_insert on public.booking_reviews;
create policy booking_reviews_parent_insert on public.booking_reviews
for insert to authenticated
with check (
  exists (
    select 1
    from public.bookings b
    join public.parents p on p.id = b.parent_id
    where b.id = booking_reviews.booking_id
      and p.user_id = auth.uid()
      and b.status = 'concluida'
  )
);

drop policy if exists payment_provider_customers_service_all on public.payment_provider_customers;
create policy payment_provider_customers_service_all on public.payment_provider_customers
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists payment_orders_service_all on public.payment_orders;
create policy payment_orders_service_all on public.payment_orders
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists payment_charges_service_all on public.payment_charges;
create policy payment_charges_service_all on public.payment_charges
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists payment_refunds_service_all on public.payment_refunds;
create policy payment_refunds_service_all on public.payment_refunds
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists payment_webhook_events_service_all on public.payment_webhook_events;
create policy payment_webhook_events_service_all on public.payment_webhook_events
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists payment_orders_parent_select on public.payment_orders;
create policy payment_orders_parent_select on public.payment_orders
for select to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.id = payment_orders.parent_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists payment_charges_parent_select on public.payment_charges;
create policy payment_charges_parent_select on public.payment_charges
for select to authenticated
using (
  exists (
    select 1
    from public.payment_orders po
    join public.parents p on p.id = po.parent_id
    where po.id = payment_charges.payment_order_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists payment_refunds_parent_select on public.payment_refunds;
create policy payment_refunds_parent_select on public.payment_refunds
for select to authenticated
using (
  exists (
    select 1
    from public.payment_orders po
    join public.parents p on p.id = po.parent_id
    where po.id = payment_refunds.payment_order_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists notification_device_types_read on public.notification_device_types;
create policy notification_device_types_read on public.notification_device_types
for select to authenticated
using (true);

drop policy if exists notification_device_types_service_all on public.notification_device_types;
create policy notification_device_types_service_all on public.notification_device_types
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists notification_devices_service_all on public.notification_devices;
create policy notification_devices_service_all on public.notification_devices
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists notification_devices_owner_all on public.notification_devices;
create policy notification_devices_owner_all on public.notification_devices
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notification_preferences_service_all on public.notification_preferences;
create policy notification_preferences_service_all on public.notification_preferences
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists notification_preferences_owner_all on public.notification_preferences;
create policy notification_preferences_owner_all on public.notification_preferences
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_service_all on public.notifications;
create policy notifications_service_all on public.notifications
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists notifications_owner_select_update on public.notifications;
create policy notifications_owner_select_update on public.notifications
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notification_deliveries_service_all on public.notification_deliveries;
create policy notification_deliveries_service_all on public.notification_deliveries
for all to service_role, postgres
using (true)
with check (true);

drop policy if exists notification_deliveries_owner_select on public.notification_deliveries;
create policy notification_deliveries_owner_select on public.notification_deliveries
for select to authenticated
using (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_deliveries.notification_id
      and n.user_id = auth.uid()
  )
);

-- Extra normalized participant policies for existing RLS-enabled tables.
drop policy if exists bookings_normalized_participant_select on public.bookings;
create policy bookings_normalized_participant_select on public.bookings
for select to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.id = bookings.parent_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.teachers t
    where t.id = bookings.teacher_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists chat_threads_normalized_participant_select on public.chat_threads;
create policy chat_threads_normalized_participant_select on public.chat_threads
for select to authenticated
using (
  exists (
    select 1 from public.parents p
    where p.id = chat_threads.parent_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.teachers t
    where t.id = chat_threads.teacher_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists chat_messages_normalized_participant_select on public.chat_messages;
create policy chat_messages_normalized_participant_select on public.chat_messages
for select to authenticated
using (
  exists (
    select 1
    from public.chat_threads t
    join public.parents p on p.id = t.parent_id
    where t.id = chat_messages.thread_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chat_threads t
    join public.teachers teacher on teacher.id = t.teacher_id
    where t.id = chat_messages.thread_id
      and teacher.user_id = auth.uid()
  )
);

drop policy if exists booking_activity_plans_normalized_participant_select on public.booking_activity_plans;
create policy booking_activity_plans_normalized_participant_select on public.booking_activity_plans
for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.parents p on p.id = b.parent_id
    where b.id = booking_activity_plans.booking_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.teachers t on t.id = b.teacher_id
    where b.id = booking_activity_plans.booking_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists booking_follow_ups_normalized_participant_select on public.booking_follow_ups;
create policy booking_follow_ups_normalized_participant_select on public.booking_follow_ups
for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.parents p on p.id = b.parent_id
    where b.id = booking_follow_ups.booking_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.teachers t on t.id = b.teacher_id
    where b.id = booking_follow_ups.booking_id
      and t.user_id = auth.uid()
  )
);

commit;
