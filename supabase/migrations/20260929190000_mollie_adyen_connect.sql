-- Mollie Connect and Adyen hosted onboarding.
-- Platform client credentials stay in platform_integrations.
-- Per-restaurant tokens and Adyen account ids are service-role only.

insert into public.platform_integrations (key, enabled, config)
values ('adyen', false, '{}'::jsonb)
on conflict (key) do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, perm.key
from public.restaurant_positions rp
cross join (
  values
    ('integrations.mollie'),
    ('integrations.adyen')
) as perm(key)
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create table public.restaurant_mollie_connections (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  status text not null default 'disconnected' check (status in ('disconnected', 'connected')),
  organization_name text,
  organization_id text,
  profile_id text,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  scope text,
  connected_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_mollie_connections_token_when_connected check (
    status <> 'connected'
    or (
      access_token is not null
      and char_length(trim(access_token)) > 0
    )
  )
);

create table public.restaurant_adyen_connections (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  status text not null default 'disconnected' check (status in ('disconnected', 'connected')),
  env text not null default 'test' check (env in ('test', 'live')),
  legal_name text,
  legal_entity_id text,
  account_holder_id text,
  balance_account_id text,
  connected_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_adyen_connections_account_when_connected check (
    status <> 'connected'
    or (
      legal_entity_id is not null
      and char_length(trim(legal_entity_id)) > 0
      and account_holder_id is not null
      and char_length(trim(account_holder_id)) > 0
      and balance_account_id is not null
      and char_length(trim(balance_account_id)) > 0
    )
  )
);

create trigger restaurant_mollie_connections_set_updated_at
  before update on public.restaurant_mollie_connections
  for each row execute function public.set_updated_at();

create trigger restaurant_adyen_connections_set_updated_at
  before update on public.restaurant_adyen_connections
  for each row execute function public.set_updated_at();

alter table public.restaurant_mollie_connections enable row level security;
alter table public.restaurant_adyen_connections enable row level security;

revoke all on table public.restaurant_mollie_connections from public;
revoke all on table public.restaurant_mollie_connections from anon;
revoke all on table public.restaurant_mollie_connections from authenticated;
grant all on table public.restaurant_mollie_connections to service_role;

revoke all on table public.restaurant_adyen_connections from public;
revoke all on table public.restaurant_adyen_connections from anon;
revoke all on table public.restaurant_adyen_connections from authenticated;
grant all on table public.restaurant_adyen_connections to service_role;
