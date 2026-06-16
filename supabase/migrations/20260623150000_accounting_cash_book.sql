-- Buchführung: Kassenbuch (Anfangsbestand, Buchungen, Einnahme-/Ausgabe-Arten)

create table public.accounting_cash_book_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  opening_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.accounting_cash_book_settings is
  'Kassenbuch: Anfangsbestand pro Restaurant.';

create trigger accounting_cash_book_settings_set_updated_at
  before update on public.accounting_cash_book_settings
  for each row execute function public.set_updated_at();

alter table public.accounting_cash_book_settings enable row level security;

create policy accounting_cash_book_settings_staff_select
  on public.accounting_cash_book_settings for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_cash_book_settings_staff_write
  on public.accounting_cash_book_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- ── Einnahme-/Ausgabe-Arten ────────────────────────────────────────────────────

create table public.accounting_cash_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  direction text not null check (direction in ('income', 'expense')),
  name text not null,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index accounting_cash_categories_restaurant_direction_name_active_uidx
  on public.accounting_cash_categories (restaurant_id, direction, lower(name))
  where not archived;

create index accounting_cash_categories_restaurant_id_idx
  on public.accounting_cash_categories (restaurant_id);

create trigger accounting_cash_categories_set_updated_at
  before update on public.accounting_cash_categories
  for each row execute function public.set_updated_at();

alter table public.accounting_cash_categories enable row level security;

create policy accounting_cash_categories_staff_select
  on public.accounting_cash_categories for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_cash_categories_staff_write
  on public.accounting_cash_categories for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- ── Buchungen ──────────────────────────────────────────────────────────────────

create table public.accounting_cash_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  entry_date date not null default (timezone('utc', now()))::date,
  direction text not null check (direction in ('income', 'expense')),
  category_id uuid not null references public.accounting_cash_categories (id) on delete restrict,
  amount numeric(14, 2) not null,
  tax_rate_percent numeric(8, 4) not null default 0,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_cash_entries_amount_positive check (amount > 0)
);

create index accounting_cash_entries_restaurant_date_idx
  on public.accounting_cash_entries (restaurant_id, entry_date desc, created_at desc);

create index accounting_cash_entries_category_id_idx
  on public.accounting_cash_entries (category_id);

create trigger accounting_cash_entries_set_updated_at
  before update on public.accounting_cash_entries
  for each row execute function public.set_updated_at();

alter table public.accounting_cash_entries enable row level security;

create policy accounting_cash_entries_staff_select
  on public.accounting_cash_entries for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_cash_entries_staff_write
  on public.accounting_cash_entries for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));
