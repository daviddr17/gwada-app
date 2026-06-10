-- Connector-neutrale Buchhaltungs-Einstellungen (Auto-Sync, letzte Sync-Zeiten).

alter table public.restaurant_accounting_settings
  add column if not exists connector_settings jsonb not null default '{}'::jsonb;

alter table public.restaurant_accounting_settings
  drop constraint if exists restaurant_accounting_settings_connector_settings_is_object;

alter table public.restaurant_accounting_settings
  add constraint restaurant_accounting_settings_connector_settings_is_object
  check (jsonb_typeof(connector_settings) = 'object');

comment on column public.restaurant_accounting_settings.connector_settings is
  'Pro Connector: autoSync, lastSync (invoices, quotations, vouchers).';

-- Bestehende Lexware-Spalten in connector_settings übernehmen.
update public.restaurant_accounting_settings r
set connector_settings = jsonb_build_object(
  'lexoffice',
  jsonb_build_object(
    'autoSync', coalesce(r.auto_sync_lexoffice, true),
    'lastSync', jsonb_strip_nulls(
      jsonb_build_object(
        'invoices', r.last_lexoffice_invoices_sync_at,
        'quotations', r.last_lexoffice_quotations_sync_at,
        'vouchers', r.last_lexoffice_vouchers_sync_at
      )
    )
  )
)
where not (coalesce(r.connector_settings, '{}'::jsonb) ? 'lexoffice');
