-- POS-Z Autopilot: Checkliste, Retry, vorbereitetes PSP-Gebühren-Modell

alter table public.accounting_pos_z_imports
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'running', 'ok', 'partial', 'error', 'skipped'));

alter table public.accounting_pos_z_imports
  add column if not exists steps jsonb not null default '[]'::jsonb;

alter table public.accounting_pos_z_imports
  add column if not exists retry_count integer not null default 0;

alter table public.accounting_pos_z_imports
  add column if not exists unbar_gross_cents bigint not null default 0;

alter table public.accounting_pos_z_imports
  add column if not exists fee_cents bigint not null default 0;

alter table public.accounting_pos_z_imports
  add column if not exists fee_voucher_id uuid
    references public.accounting_vouchers (id) on delete set null;

alter table public.accounting_pos_z_imports
  add column if not exists completed_at timestamptz;

comment on column public.accounting_pos_z_imports.steps is
  'Autopilot-Checkliste: [{key,label,status,detail?,error?}]';

comment on column public.accounting_pos_z_imports.unbar_gross_cents is
  'Unbar-Bruttoumsatz der Sitzung (für späteren Abgleich Gebühren/Netto).';

comment on column public.accounting_pos_z_imports.fee_cents is
  'PSP-Gebühren sobald Settlement gebucht (z. B. 1200 Unbar → 10 Gebühr → 1190 Netto).';

-- Spätere Mollie/Adyen-Settlements: Brutto / Gebühr / Netto → Lexoffice-Aufwand
create table if not exists public.accounting_psp_settlements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  provider text not null check (provider in ('mollie', 'adyen', 'other')),
  external_settlement_id text not null,
  settlement_date date not null,
  currency char(3) not null default 'EUR',
  gross_cents bigint not null default 0 check (gross_cents >= 0),
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  net_cents bigint not null default 0,
  pos_register_session_id uuid references public.pos_register_sessions (id) on delete set null,
  fee_voucher_id uuid references public.accounting_vouchers (id) on delete set null,
  fee_cash_entry_id uuid references public.accounting_cash_entries (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'booked', 'error', 'skipped')),
  last_error text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, provider, external_settlement_id)
);

create index if not exists accounting_psp_settlements_restaurant_date_idx
  on public.accounting_psp_settlements (restaurant_id, settlement_date desc);

create trigger accounting_psp_settlements_set_updated_at
  before update on public.accounting_psp_settlements
  for each row execute function public.set_updated_at();

alter table public.accounting_psp_settlements enable row level security;

drop policy if exists accounting_psp_settlements_staff_select
  on public.accounting_psp_settlements;
create policy accounting_psp_settlements_staff_select
  on public.accounting_psp_settlements for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists accounting_psp_settlements_staff_write
  on public.accounting_psp_settlements;
create policy accounting_psp_settlements_staff_write
  on public.accounting_psp_settlements for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

comment on table public.accounting_psp_settlements is
  'PSP-Auszahlungen (Mollie/Adyen): Brutto/Gebühr/Netto für Autopilot-Buchung nach Lexoffice.';
