-- DSFinV-K cash register + register session / Z-Bon counter per restaurant.

alter table public.pos_restaurant_fiscal_config
  add column if not exists dsfinvk_cash_register_ready boolean not null default false,
  add column if not exists cash_point_closing_counter integer not null default 0,
  add column if not exists register_opened_at timestamptz,
  add column if not exists last_cash_point_closing_id uuid,
  add column if not exists last_closing_at timestamptz,
  add column if not exists last_closing_z_nr integer;

comment on column public.pos_restaurant_fiscal_config.dsfinvk_cash_register_ready is
  'DSFinV-K MASTER cash register created for fiskaly_client_id.';
comment on column public.pos_restaurant_fiscal_config.cash_point_closing_counter is
  'Last Z_NR (cash_point_closing_export_id) sent to DSFinV-K.';
comment on column public.pos_restaurant_fiscal_config.register_opened_at is
  'Open register session start (Kassenöffnung); null when closed.';
