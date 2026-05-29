-- Kidario PSP payments, teacher decisions, and split support.
--
-- Apply after 013_api_v2_cutover.sql.

begin;

alter table if exists public.bookings
  add column if not exists teacher_decision_status text not null default 'pending',
  add column if not exists teacher_decision_reason text,
  add column if not exists teacher_decision_at timestamptz,
  add column if not exists payment_flow_status text not null default 'not_started';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'bookings_teacher_decision_status_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings drop constraint bookings_teacher_decision_status_check;
  end if;

  alter table public.bookings
    add constraint bookings_teacher_decision_status_check
    check (teacher_decision_status in ('pending', 'accepted', 'rejected'));

  if exists (
    select 1 from pg_constraint
    where conname = 'bookings_payment_flow_status_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings drop constraint bookings_payment_flow_status_check;
  end if;

  alter table public.bookings
    add constraint bookings_payment_flow_status_check
    check (
      payment_flow_status in (
        'not_started',
        'authorization_required',
        'authorized',
        'awaiting_payment',
        'paid',
        'failed',
        'expired',
        'refunded'
      )
    );
end
$$;

alter table if exists public.payment_orders
  add column if not exists requested_payment_method text,
  add column if not exists authorized_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists expires_at timestamptz;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'payment_orders_status_check'
      and conrelid = 'public.payment_orders'::regclass
  ) then
    alter table public.payment_orders drop constraint payment_orders_status_check;
  end if;

  alter table public.payment_orders
    add constraint payment_orders_status_check
    check (
      status in (
        'created',
        'pending',
        'authorized',
        'paid',
        'payment_failed',
        'canceled',
        'expired',
        'refunded',
        'partially_refunded'
      )
    );

  if exists (
    select 1 from pg_constraint
    where conname = 'payment_orders_requested_payment_method_check'
      and conrelid = 'public.payment_orders'::regclass
  ) then
    alter table public.payment_orders drop constraint payment_orders_requested_payment_method_check;
  end if;

  alter table public.payment_orders
    add constraint payment_orders_requested_payment_method_check
    check (
      requested_payment_method is null
      or requested_payment_method in ('credit_card', 'pix', 'boleto')
    );
end
$$;

alter table if exists public.payment_charges
  add column if not exists card_brand text,
  add column if not exists card_last_four text,
  add column if not exists card_holder_name text,
  add column if not exists authorization_code text,
  add column if not exists authorized_at timestamptz,
  add column if not exists captured_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists payment_url text,
  add column if not exists boleto_barcode text,
  add column if not exists boleto_line text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'payment_charges_status_check'
      and conrelid = 'public.payment_charges'::regclass
  ) then
    alter table public.payment_charges drop constraint payment_charges_status_check;
  end if;

  alter table public.payment_charges
    add constraint payment_charges_status_check
    check (
      status in (
        'pending',
        'processing',
        'authorized',
        'waiting_capture',
        'paid',
        'payment_failed',
        'failed',
        'canceled',
        'expired',
        'refunded',
        'chargedback'
      )
    );
end
$$;

create table if not exists public.teacher_payout_profiles (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references public.teachers(id) on delete cascade,
  legal_name text not null,
  document_type text not null check (document_type in ('cpf', 'cnpj')),
  document_number text not null,
  bank_code text not null,
  branch_number text not null,
  branch_check_digit text,
  account_number text not null,
  account_check_digit text,
  account_type text not null check (account_type in ('checking', 'savings')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'disabled')),
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_provider_recipients (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.teachers(id) on delete cascade,
  provider text not null default 'pagarme',
  provider_recipient_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'disabled')),
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_provider_recipients_provider_recipient_unique
    unique (provider, provider_recipient_id),
  constraint payment_provider_recipients_teacher_provider_unique
    unique (teacher_id, provider)
);

create table if not exists public.payment_splits (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  payment_charge_id uuid references public.payment_charges(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  provider text not null default 'pagarme',
  provider_recipient_id text not null,
  split_role text not null check (split_role in ('platform', 'teacher')),
  type text not null check (type in ('flat', 'percentage')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  percentage numeric(7,4) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  liable boolean not null default false,
  charge_processing_fee boolean not null default false,
  charge_remainder_fee boolean not null default false,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_payment_webhook_events_provider_event_unique
  on public.payment_webhook_events(provider, provider_event_id)
  where provider_event_id is not null;

create index if not exists idx_payment_splits_order
  on public.payment_splits(payment_order_id);

create index if not exists idx_payment_splits_teacher
  on public.payment_splits(teacher_id);

create index if not exists idx_teacher_payout_profiles_teacher
  on public.teacher_payout_profiles(teacher_id);

drop index if exists idx_bookings_teacher_starts_at_active_unique;

create unique index if not exists idx_bookings_teacher_starts_at_active_unique
  on public.bookings(teacher_id, starts_at)
  where status in ('pendente', 'confirmada')
    and teacher_decision_status <> 'rejected';

commit;
