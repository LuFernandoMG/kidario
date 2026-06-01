-- The v2 PSP flow writes payment_orders/payment_charges explicitly after the
-- provider returns. The old booking trigger created a legacy payment_order as
-- soon as a booking row was inserted, which conflicts with the real PSP order.

drop trigger if exists trg_sync_payment_from_booking on public.bookings;

alter table if exists public.payment_orders
  add column if not exists requested_payment_method text,
  add column if not exists authorized_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists provider_response jsonb;

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
  add column if not exists boleto_line text,
  add column if not exists provider_response jsonb;

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

drop index if exists public.idx_payment_orders_booking_unique;

create index if not exists idx_payment_orders_booking_created_at
  on public.payment_orders(booking_id, created_at desc)
  where booking_id is not null;
