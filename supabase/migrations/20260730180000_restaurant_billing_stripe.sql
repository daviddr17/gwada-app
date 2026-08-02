-- SaaS billing: restaurant subscriptions (Stripe) + POS add-on + billing.manage

-- ---------------------------------------------------------------------------
-- Platform Stripe secrets (Superadmin → Integrationen)
-- ---------------------------------------------------------------------------
insert into public.platform_integrations (key, enabled, config)
values (
  'stripe',
  false,
  jsonb_build_object(
    'mode', 'test',
    'publishable_key', '',
    'secret_key', '',
    'webhook_secret', '',
    'price_basic_monthly', '',
    'price_basic_yearly', '',
    'price_pro_monthly', '',
    'price_pro_yearly', '',
    'price_pos_monthly', '',
    'price_pos_yearly', ''
  )
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Subscriptions (one row per restaurant)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_subscriptions (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  plan_id text not null default 'free'
    check (plan_id in ('free', 'basic', 'pro')),
  interval text not null default 'month'
    check (interval in ('month', 'year')),
  status text not null default 'active'
    check (status in (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
      'unpaid',
      'legacy'
    )),
  source text not null default 'manual'
    check (source in ('stripe', 'manual', 'legacy', 'complimentary')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists restaurant_subscriptions_stripe_customer_uidx
  on public.restaurant_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists restaurant_subscriptions_stripe_subscription_uidx
  on public.restaurant_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

drop trigger if exists restaurant_subscriptions_set_updated_at
  on public.restaurant_subscriptions;
create trigger restaurant_subscriptions_set_updated_at
  before update on public.restaurant_subscriptions
  for each row execute function public.set_updated_at();

comment on table public.restaurant_subscriptions is
  'Gwada SaaS plan per restaurant (Stripe Billing). POS is a separate add-on row.';

-- ---------------------------------------------------------------------------
-- Add-ons (POS etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_subscription_addons (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  addon_id text not null check (addon_id in ('pos')),
  status text not null default 'active'
    check (status in ('active', 'canceled', 'past_due', 'incomplete', 'legacy')),
  interval text not null default 'month'
    check (interval in ('month', 'year')),
  stripe_subscription_item_id text,
  stripe_price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, addon_id)
);

drop trigger if exists restaurant_subscription_addons_set_updated_at
  on public.restaurant_subscription_addons;
create trigger restaurant_subscription_addons_set_updated_at
  before update on public.restaurant_subscription_addons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grandfather existing restaurants → Pro (legacy), so nothing locks overnight
-- ---------------------------------------------------------------------------
insert into public.restaurant_subscriptions (
  restaurant_id, plan_id, interval, status, source, notes
)
select
  r.id,
  'pro',
  'month',
  'legacy',
  'legacy',
  'Grandfathered before Stripe billing launch'
from public.restaurants r
on conflict (restaurant_id) do nothing;

-- ---------------------------------------------------------------------------
-- New restaurants default to Free
-- ---------------------------------------------------------------------------
create or replace function public.ensure_restaurant_subscription_free()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.restaurant_subscriptions (
    restaurant_id, plan_id, interval, status, source
  )
  values (new.id, 'free', 'month', 'active', 'manual')
  on conflict (restaurant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists restaurants_ensure_subscription on public.restaurants;
create trigger restaurants_ensure_subscription
  after insert on public.restaurants
  for each row execute function public.ensure_restaurant_subscription_free();

-- ---------------------------------------------------------------------------
-- Permission: billing.manage
-- ---------------------------------------------------------------------------
insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'billing.manage'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.restaurant_subscriptions enable row level security;
alter table public.restaurant_subscription_addons enable row level security;

drop policy if exists restaurant_subscriptions_select on public.restaurant_subscriptions;
create policy restaurant_subscriptions_select
  on public.restaurant_subscriptions for select
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'billing.manage')
    or public.auth_has_restaurant_permission(restaurant_id, 'settings.restaurant')
    or public.auth_is_superadmin()
  );

drop policy if exists restaurant_subscriptions_no_client_write
  on public.restaurant_subscriptions;
create policy restaurant_subscriptions_no_client_write
  on public.restaurant_subscriptions for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

drop policy if exists restaurant_subscription_addons_select
  on public.restaurant_subscription_addons;
create policy restaurant_subscription_addons_select
  on public.restaurant_subscription_addons for select
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'billing.manage')
    or public.auth_has_restaurant_permission(restaurant_id, 'settings.restaurant')
    or public.auth_is_superadmin()
  );

drop policy if exists restaurant_subscription_addons_no_client_write
  on public.restaurant_subscription_addons;
create policy restaurant_subscription_addons_no_client_write
  on public.restaurant_subscription_addons for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

revoke all on table public.restaurant_subscriptions from public;
grant select on table public.restaurant_subscriptions to authenticated;
grant all on table public.restaurant_subscriptions to service_role;

revoke all on table public.restaurant_subscription_addons from public;
grant select on table public.restaurant_subscription_addons to authenticated;
grant all on table public.restaurant_subscription_addons to service_role;
