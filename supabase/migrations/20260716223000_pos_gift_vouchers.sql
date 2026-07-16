-- POS Wertgutscheine: Ausstellung, Einlösung, Storno, Verfall + Zahlungsart

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'pos_payment_method'
      and e.enumlabel = 'voucher'
  ) then
    alter type public.pos_payment_method add value 'voucher';
  end if;
end $$;

create table if not exists public.pos_gift_voucher_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  default_validity_months integer not null default 36
    check (default_validity_months >= 1 and default_validity_months <= 120),
  -- Ziel-Drucker für Gutschein-Ausdruck (Thermo); null = nur PDF / Client-Druck
  voucher_printer_id uuid references public.pos_printers (id) on delete set null,
  -- 'a4' | 'thermal' | 'both' — bevorzugtes Format beim Ausstellen
  print_format text not null default 'both'
    check (print_format in ('a4', 'thermal', 'both')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.pos_gift_voucher_settings is
  'POS Gutscheine: Standard-Gültigkeit und Druckziele pro Restaurant.';

create trigger pos_gift_voucher_settings_set_updated_at
  before update on public.pos_gift_voucher_settings
  for each row execute function public.set_updated_at();

alter table public.pos_gift_voucher_settings enable row level security;

drop policy if exists pos_gift_voucher_settings_staff_all on public.pos_gift_voucher_settings;
create policy pos_gift_voucher_settings_staff_all
  on public.pos_gift_voucher_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create table if not exists public.pos_gift_vouchers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- Kurzcode für manuelle Eingabe (eindeutig pro Restaurant)
  code text not null,
  -- Token im QR (URL-sicher, eindeutig global)
  public_token text not null,
  initial_amount_cents bigint not null check (initial_amount_cents > 0),
  balance_cents bigint not null check (balance_cents >= 0),
  currency char(3) not null default 'EUR',
  status text not null default 'active'
    check (status in ('active', 'redeemed', 'voided', 'expired')),
  validity_months_at_issue integer not null check (validity_months_at_issue >= 1),
  issued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  voided_at timestamptz,
  expired_at timestamptz,
  issued_by_profile_id uuid references public.profiles (id) on delete set null,
  voided_by_profile_id uuid references public.profiles (id) on delete set null,
  issue_payment_method text not null default 'cash'
    check (issue_payment_method in ('cash', 'card', 'terminal', 'paypal', 'other')),
  issue_order_id uuid references public.pos_orders (id) on delete set null,
  issue_payment_id uuid references public.pos_payments (id) on delete set null,
  issue_cash_entry_id uuid references public.accounting_cash_entries (id) on delete set null,
  void_cash_entry_id uuid references public.accounting_cash_entries (id) on delete set null,
  expire_accounting_voucher_id uuid references public.accounting_vouchers (id) on delete set null,
  last_printed_at timestamptz,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pos_gift_vouchers_balance_lte_initial
    check (balance_cents <= initial_amount_cents),
  constraint pos_gift_vouchers_code_format
    check (char_length(code) >= 6 and char_length(code) <= 32)
);

create unique index if not exists pos_gift_vouchers_restaurant_code_uidx
  on public.pos_gift_vouchers (restaurant_id, lower(code));

create unique index if not exists pos_gift_vouchers_public_token_uidx
  on public.pos_gift_vouchers (public_token);

create index if not exists pos_gift_vouchers_restaurant_status_idx
  on public.pos_gift_vouchers (restaurant_id, status, issued_at desc);

create index if not exists pos_gift_vouchers_restaurant_expires_idx
  on public.pos_gift_vouchers (restaurant_id, expires_at)
  where status = 'active';

create trigger pos_gift_vouchers_set_updated_at
  before update on public.pos_gift_vouchers
  for each row execute function public.set_updated_at();

alter table public.pos_gift_vouchers enable row level security;

drop policy if exists pos_gift_vouchers_staff_all on public.pos_gift_vouchers;
create policy pos_gift_vouchers_staff_all
  on public.pos_gift_vouchers for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_gift_vouchers is
  'Wertgutscheine: Guthaben bis leer einlösbar; Gültigkeit bei Ausstellung eingefroren.';

create table if not exists public.pos_gift_voucher_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  gift_voucher_id uuid not null references public.pos_gift_vouchers (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'issued',
      'redeemed',
      'voided',
      'expired',
      'reprinted'
    )),
  amount_cents bigint not null default 0,
  balance_after_cents bigint not null check (balance_after_cents >= 0),
  pos_payment_id uuid references public.pos_payments (id) on delete set null,
  cash_entry_id uuid references public.accounting_cash_entries (id) on delete set null,
  accounting_voucher_id uuid references public.accounting_vouchers (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists pos_gift_voucher_events_voucher_idx
  on public.pos_gift_voucher_events (gift_voucher_id, created_at desc);

create index if not exists pos_gift_voucher_events_restaurant_idx
  on public.pos_gift_voucher_events (restaurant_id, created_at desc);

alter table public.pos_gift_voucher_events enable row level security;

drop policy if exists pos_gift_voucher_events_staff_select on public.pos_gift_voucher_events;
create policy pos_gift_voucher_events_staff_select
  on public.pos_gift_voucher_events for select
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists pos_gift_voucher_events_staff_insert on public.pos_gift_voucher_events;
create policy pos_gift_voucher_events_staff_insert
  on public.pos_gift_voucher_events for insert
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_gift_voucher_events is
  'Audit-Log für Gutschein-Ausstellung, Einlösung, Storno, Verfall, Nachdruck.';

alter table public.pos_payments
  add column if not exists gift_voucher_id uuid
    references public.pos_gift_vouchers (id) on delete set null;

create index if not exists pos_payments_gift_voucher_id_idx
  on public.pos_payments (gift_voucher_id)
  where gift_voucher_id is not null;

-- Gutschein-Verkaufsorders ohne Tischsitzung erlauben
alter table public.pos_orders
  alter column table_session_id drop not null;

alter table public.pos_orders
  add column if not exists gift_voucher_id uuid
    references public.pos_gift_vouchers (id) on delete set null;

create or replace function public.pos_orders_enforce_table_session_restaurant()
returns trigger
language plpgsql
as $$
declare
  v_session_restaurant uuid;
begin
  if new.table_session_id is null then
    -- Nur Gutschein-Verkaufsorders ohne Tisch
    if new.gift_voucher_id is null and coalesce(new.notes, '') not like 'gift_voucher:%' then
      raise exception 'pos_orders.table_session_id required unless gift voucher sale';
    end if;
    return new;
  end if;

  select s.restaurant_id
  into v_session_restaurant
  from public.pos_table_sessions s
  where s.id = new.table_session_id;

  if v_session_restaurant is null then
    raise exception 'pos_orders.table_session_id not found';
  end if;

  if new.restaurant_id is distinct from v_session_restaurant then
    raise exception 'pos_orders.restaurant_id must match table session restaurant';
  end if;

  return new;
end;
$$;
