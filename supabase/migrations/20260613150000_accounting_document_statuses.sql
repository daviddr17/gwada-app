-- Konfigurierbare Status für Rechnungen, Angebote und Belege

create table public.accounting_document_statuses (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  document_kind text not null
    check (document_kind in ('invoice', 'quotation', 'voucher')),
  code text not null,
  label text not null,
  sort_order integer not null default 0,
  archived boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_document_statuses_code_format
    check (code ~ '^[a-z][a-z0-9_]{0,39}$')
);

create unique index accounting_document_statuses_restaurant_kind_code_uidx
  on public.accounting_document_statuses (restaurant_id, document_kind, code);

create index accounting_document_statuses_restaurant_kind_idx
  on public.accounting_document_statuses (restaurant_id, document_kind, sort_order);

create trigger accounting_document_statuses_set_updated_at
  before update on public.accounting_document_statuses
  for each row execute function public.set_updated_at();

alter table public.accounting_document_statuses enable row level security;

create policy accounting_document_statuses_staff_select
  on public.accounting_document_statuses for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_document_statuses_staff_write
  on public.accounting_document_statuses for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- Freie Status-Codes (konfigurierbar pro Restaurant)
alter table public.accounting_invoices
  drop constraint if exists accounting_invoices_status_check;

alter table public.accounting_quotations
  drop constraint if exists accounting_quotations_status_check;

alter table public.accounting_vouchers
  drop constraint if exists accounting_vouchers_status_check;
