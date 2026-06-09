-- Buchführung: Restaurant-Einstellungen (PDF/ZUGFeRD, Lexware-Sync)

create table public.restaurant_accounting_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  document_format text not null default 'pdf'
    check (document_format in ('pdf', 'zugferd_pdf')),
  auto_sync_lexoffice boolean not null default true,
  last_lexoffice_invoices_sync_at timestamptz,
  last_lexoffice_quotations_sync_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on column public.restaurant_accounting_settings.document_format is
  'pdf = nur PDF; zugferd_pdf = PDF + ZUGFeRD/XRechnung (XML) wo verfügbar (Lexware).';

create trigger restaurant_accounting_settings_set_updated_at
  before update on public.restaurant_accounting_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_accounting_settings enable row level security;

create policy restaurant_accounting_settings_staff_select
  on public.restaurant_accounting_settings for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_accounting_settings_staff_write
  on public.restaurant_accounting_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));
