-- Repair: pos_restaurant_fiscal_config fehlt auf Live, wenn 20260607140000
-- als applied markiert war, bevor 20260607130000 nachgezogen wurde (Merge-Reihenfolge).

insert into public.platform_integrations (key, enabled, config)
values
  (
    'fiskaly',
    false,
    jsonb_build_object(
      'sign_de_base_url',
      'https://kassensichv-middleware.fiskaly.com/api/v2',
      'ereceipt_base_url',
      'https://receipt.fiskaly.com/api/v1',
      'env',
      'TEST'
    )
  ),
  ('mollie', false, '{}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.pos_restaurant_fiscal_config (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  fiskaly_enabled boolean not null default false,
  fiskaly_tss_id text,
  fiskaly_client_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pos_restaurant_fiscal_config_tss_when_enabled check (
    not fiskaly_enabled
    or (
      fiskaly_tss_id is not null
      and char_length(trim(fiskaly_tss_id)) > 0
      and fiskaly_client_id is not null
      and char_length(trim(fiskaly_client_id)) > 0
    )
  )
);

drop trigger if exists pos_restaurant_fiscal_config_set_updated_at
  on public.pos_restaurant_fiscal_config;

create trigger pos_restaurant_fiscal_config_set_updated_at
  before update on public.pos_restaurant_fiscal_config
  for each row execute function public.set_updated_at();

alter table public.pos_restaurant_fiscal_config enable row level security;

drop policy if exists pos_restaurant_fiscal_config_staff_select
  on public.pos_restaurant_fiscal_config;
create policy pos_restaurant_fiscal_config_staff_select
  on public.pos_restaurant_fiscal_config for select
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists pos_restaurant_fiscal_config_staff_write
  on public.pos_restaurant_fiscal_config;
create policy pos_restaurant_fiscal_config_staff_write
  on public.pos_restaurant_fiscal_config for all
  using (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager']::public.employee_role[]
    )
  )
  with check (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager']::public.employee_role[]
    )
  );

comment on table public.pos_restaurant_fiscal_config is
  'Per-restaurant Fiskaly TSS/client IDs. API credentials live in platform_integrations.fiskaly.';
