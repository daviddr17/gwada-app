-- Buchführung: Rechnungen, Angebote, Belege, Artikel, Einheiten, Steuersätze.

-- ── Berechtigung ─────────────────────────────────────────────────────────────

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'accounting.manage'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create or replace function public.auth_user_restaurant_permission_keys(p_restaurant_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct rpp.permission_key
  from public.restaurant_employees re
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = re.position_id
  where re.restaurant_id = p_restaurant_id
    and re.profile_id = (select auth.uid())
    and re.is_active
    and re.position_id is not null
  union
  select unnest(array[
    'roles.manage',
    'team.manage',
    'integrations.whatsapp',
    'integrations.email',
    'integrations.facebook',
    'integrations.instagram',
    'integrations.google_business',
    'integrations.lexoffice',
    'settings.restaurant',
    'settings.opening_hours',
    'settings.branding',
    'settings.dashboard',
    'documents.notes.edit',
    'display.manage',
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.inventory',
    'display.kds',
    'display.module_switch',
    'pos.kasse.manage',
    'pos.kasse.export',
    'accounting.manage'
  ]::text[])
  where exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  );
$$;

-- ── Steuersätze ────────────────────────────────────────────────────────────────

create table public.accounting_tax_rates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label text not null,
  rate_percent numeric(8, 4) not null default 0,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_tax_rates_rate_percent_nonneg check (rate_percent >= 0)
);

create index accounting_tax_rates_restaurant_id_idx
  on public.accounting_tax_rates (restaurant_id);

create trigger accounting_tax_rates_set_updated_at
  before update on public.accounting_tax_rates
  for each row execute function public.set_updated_at();

alter table public.accounting_tax_rates enable row level security;

create policy accounting_tax_rates_staff_select
  on public.accounting_tax_rates for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_tax_rates_staff_write
  on public.accounting_tax_rates for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- ── Einheiten ──────────────────────────────────────────────────────────────────

create table public.accounting_units (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index accounting_units_restaurant_name_active_uidx
  on public.accounting_units (restaurant_id, lower(name))
  where not archived;

create index accounting_units_restaurant_id_idx
  on public.accounting_units (restaurant_id);

create trigger accounting_units_set_updated_at
  before update on public.accounting_units
  for each row execute function public.set_updated_at();

alter table public.accounting_units enable row level security;

create policy accounting_units_staff_select
  on public.accounting_units for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_units_staff_write
  on public.accounting_units for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- ── Artikel ───────────────────────────────────────────────────────────────────

create table public.accounting_articles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  description text,
  unit_id uuid references public.accounting_units (id) on delete set null,
  default_unit_name text not null default 'Stück',
  default_unit_price numeric(14, 4) not null default 0,
  default_tax_rate_percent numeric(8, 4) not null default 0,
  currency text not null default 'EUR',
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_articles_price_nonneg check (default_unit_price >= 0)
);

create index accounting_articles_restaurant_id_idx
  on public.accounting_articles (restaurant_id);

create trigger accounting_articles_set_updated_at
  before update on public.accounting_articles
  for each row execute function public.set_updated_at();

alter table public.accounting_articles enable row level security;

create policy accounting_articles_staff_select
  on public.accounting_articles for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_articles_staff_write
  on public.accounting_articles for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- ── Rechnungen ────────────────────────────────────────────────────────────────

create table public.accounting_invoices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  source text not null default 'gwada'
    check (source in ('gwada', 'lexoffice')),
  external_id text,
  external_version integer,
  external_edit_url text,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'sent', 'paid', 'voided', 'overdue')),
  voucher_number text,
  voucher_date date not null default (timezone('utc', now()))::date,
  due_date date,
  currency text not null default 'EUR',
  tax_mode text not null default 'net'
    check (tax_mode in ('net', 'gross', 'vatfree')),
  recipient_type text not null default 'one_time'
    check (recipient_type in ('contact', 'one_time')),
  contact_id uuid references public.contacts (id) on delete set null,
  recipient_snapshot jsonb not null default '{}'::jsonb,
  line_items jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  title text,
  introduction text,
  remark text,
  finalize_on_create boolean not null default false,
  sent_at timestamptz,
  sent_channels jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_invoices_recipient_snapshot_is_object
    check (jsonb_typeof(recipient_snapshot) = 'object'),
  constraint accounting_invoices_line_items_is_array
    check (jsonb_typeof(line_items) = 'array'),
  constraint accounting_invoices_totals_is_object
    check (jsonb_typeof(totals) = 'object'),
  constraint accounting_invoices_sent_channels_is_array
    check (jsonb_typeof(sent_channels) = 'array')
);

create unique index accounting_invoices_restaurant_external_uidx
  on public.accounting_invoices (restaurant_id, source, external_id)
  where external_id is not null;

create index accounting_invoices_restaurant_id_idx
  on public.accounting_invoices (restaurant_id, voucher_date desc);

create trigger accounting_invoices_set_updated_at
  before update on public.accounting_invoices
  for each row execute function public.set_updated_at();

alter table public.accounting_invoices enable row level security;

create policy accounting_invoices_staff_select
  on public.accounting_invoices for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_invoices_staff_write
  on public.accounting_invoices for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- ── Angebote ──────────────────────────────────────────────────────────────────

create table public.accounting_quotations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  source text not null default 'gwada'
    check (source in ('gwada', 'lexoffice')),
  external_id text,
  external_version integer,
  external_edit_url text,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'sent', 'accepted', 'rejected', 'voided')),
  voucher_number text,
  voucher_date date not null default (timezone('utc', now()))::date,
  expiration_date date,
  currency text not null default 'EUR',
  tax_mode text not null default 'net'
    check (tax_mode in ('net', 'gross', 'vatfree')),
  recipient_type text not null default 'one_time'
    check (recipient_type in ('contact', 'one_time')),
  contact_id uuid references public.contacts (id) on delete set null,
  recipient_snapshot jsonb not null default '{}'::jsonb,
  line_items jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  title text,
  introduction text,
  remark text,
  finalize_on_create boolean not null default false,
  sent_at timestamptz,
  sent_channels jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_quotations_recipient_snapshot_is_object
    check (jsonb_typeof(recipient_snapshot) = 'object'),
  constraint accounting_quotations_line_items_is_array
    check (jsonb_typeof(line_items) = 'array'),
  constraint accounting_quotations_totals_is_object
    check (jsonb_typeof(totals) = 'object'),
  constraint accounting_quotations_sent_channels_is_array
    check (jsonb_typeof(sent_channels) = 'array')
);

create unique index accounting_quotations_restaurant_external_uidx
  on public.accounting_quotations (restaurant_id, source, external_id)
  where external_id is not null;

create index accounting_quotations_restaurant_id_idx
  on public.accounting_quotations (restaurant_id, voucher_date desc);

create trigger accounting_quotations_set_updated_at
  before update on public.accounting_quotations
  for each row execute function public.set_updated_at();

alter table public.accounting_quotations enable row level security;

create policy accounting_quotations_staff_select
  on public.accounting_quotations for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_quotations_staff_write
  on public.accounting_quotations for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- ── Belege ────────────────────────────────────────────────────────────────────

create table public.accounting_vouchers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  source text not null default 'gwada'
    check (source in ('gwada', 'lexoffice')),
  external_id text,
  external_version integer,
  external_edit_url text,
  voucher_kind text not null default 'expense'
    check (voucher_kind in ('expense', 'income', 'purchase', 'sales')),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'unchecked', 'paid', 'voided')),
  voucher_number text,
  voucher_date date not null default (timezone('utc', now()))::date,
  due_date date,
  shipping_date date,
  currency text not null default 'EUR',
  tax_mode text not null default 'gross'
    check (tax_mode in ('net', 'gross')),
  use_collective_contact boolean not null default false,
  contact_id uuid references public.contacts (id) on delete set null,
  contact_name text,
  total_gross_amount numeric(14, 4) not null default 0,
  total_tax_amount numeric(14, 4) not null default 0,
  voucher_items jsonb not null default '[]'::jsonb,
  remark text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_vouchers_voucher_items_is_array
    check (jsonb_typeof(voucher_items) = 'array'),
  constraint accounting_vouchers_amounts_nonneg
    check (total_gross_amount >= 0 and total_tax_amount >= 0)
);

create unique index accounting_vouchers_restaurant_external_uidx
  on public.accounting_vouchers (restaurant_id, source, external_id)
  where external_id is not null;

create index accounting_vouchers_restaurant_id_idx
  on public.accounting_vouchers (restaurant_id, voucher_date desc);

create trigger accounting_vouchers_set_updated_at
  before update on public.accounting_vouchers
  for each row execute function public.set_updated_at();

alter table public.accounting_vouchers enable row level security;

create policy accounting_vouchers_staff_select
  on public.accounting_vouchers for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_vouchers_staff_write
  on public.accounting_vouchers for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

-- ── Storage: Beleg-Anhänge ────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'accounting-vouchers',
  'accounting-vouchers',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy accounting_vouchers_storage_select_staff
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'accounting-vouchers'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );

create policy accounting_vouchers_storage_insert_staff
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'accounting-vouchers'
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'accounting.manage'
    )
  );

create policy accounting_vouchers_storage_delete_staff
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'accounting-vouchers'
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'accounting.manage'
    )
  );
