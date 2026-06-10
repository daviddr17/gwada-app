alter table public.restaurant_accounting_settings
  add column if not exists last_lexoffice_vouchers_sync_at timestamptz;

comment on column public.restaurant_accounting_settings.last_lexoffice_vouchers_sync_at is
  'Letzter erfolgreicher Abruf von Buchhaltungs-Belegen aus Lexware.';
