-- POS-Tagesabschluss (Z) → Buchführung: Settings + Import-Protokoll

alter table public.restaurant_accounting_settings
  add column if not exists import_pos_z_to_cash_book boolean not null default false;

alter table public.restaurant_accounting_settings
  add column if not exists push_pos_z_to_lexoffice boolean not null default false;

comment on column public.restaurant_accounting_settings.import_pos_z_to_cash_book is
  'Wenn true: nach POS-Z-Abschluss Bargeld/Trinkgeld ins Gwada-Kassenbuch buchen.';

comment on column public.restaurant_accounting_settings.push_pos_z_to_lexoffice is
  'Wenn true und Lexoffice verbunden: Z-Abschluss zusätzlich als Verkaufsbeleg an Lexoffice.';

create table if not exists public.accounting_pos_z_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  pos_register_session_id uuid not null references public.pos_register_sessions (id) on delete cascade,
  z_nr integer,
  business_date date,
  cash_book_imported boolean not null default false,
  cash_entry_ids uuid[] not null default '{}',
  lexoffice_voucher_id uuid references public.accounting_vouchers (id) on delete set null,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_pos_z_imports_session_uidx unique (pos_register_session_id)
);

create index if not exists accounting_pos_z_imports_restaurant_id_idx
  on public.accounting_pos_z_imports (restaurant_id);

comment on table public.accounting_pos_z_imports is
  'Idempotenz/Protokoll: POS-Kassensitzung → Kassenbuch / Lexoffice.';

drop trigger if exists accounting_pos_z_imports_set_updated_at
  on public.accounting_pos_z_imports;

create trigger accounting_pos_z_imports_set_updated_at
  before update on public.accounting_pos_z_imports
  for each row execute function public.set_updated_at();

alter table public.accounting_pos_z_imports enable row level security;

drop policy if exists accounting_pos_z_imports_staff_select
  on public.accounting_pos_z_imports;
create policy accounting_pos_z_imports_staff_select
  on public.accounting_pos_z_imports for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists accounting_pos_z_imports_staff_write
  on public.accounting_pos_z_imports;
create policy accounting_pos_z_imports_staff_write
  on public.accounting_pos_z_imports for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));
