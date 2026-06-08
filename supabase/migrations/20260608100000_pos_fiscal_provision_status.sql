-- Fiskaly auto-provision status per restaurant.

alter table public.pos_restaurant_fiscal_config
  add column if not exists fiskaly_provision_status text,
  add column if not exists fiskaly_provision_error text,
  add column if not exists fiskaly_provisioned_at timestamptz,
  add column if not exists fiskaly_client_serial text;

alter table public.pos_restaurant_fiscal_config
  drop constraint if exists pos_restaurant_fiscal_config_provision_status_check;

alter table public.pos_restaurant_fiscal_config
  add constraint pos_restaurant_fiscal_config_provision_status_check check (
    fiskaly_provision_status is null
    or fiskaly_provision_status in ('pending', 'ready', 'failed')
  );

comment on column public.pos_restaurant_fiscal_config.fiskaly_provision_status is
  'Fiskaly TSS/client provisioning: pending, ready, or failed.';

comment on column public.pos_restaurant_fiscal_config.fiskaly_client_serial is
  'Fiskaly client serial_number (Kasse/Terminal) at provision time.';
