-- Mollie-only payments: drop Adyen Connect, add Mollie SaaS + guest payment columns.
-- Historical Stripe columns remain for existing rows; new money paths use Mollie.

-- ---------------------------------------------------------------------------
-- Remove Adyen platform + restaurant connections
-- ---------------------------------------------------------------------------
delete from public.restaurant_position_permissions
where permission_key = 'integrations.adyen';

delete from public.platform_integrations where key = 'adyen';

drop table if exists public.restaurant_adyen_connections;

-- ---------------------------------------------------------------------------
-- Disable Stripe platform integration (secrets may remain until manually cleared)
-- ---------------------------------------------------------------------------
update public.platform_integrations
set enabled = false
where key = 'stripe';

-- ---------------------------------------------------------------------------
-- restaurant_subscriptions: Mollie ids + source
-- ---------------------------------------------------------------------------
alter table public.restaurant_subscriptions
  drop constraint if exists restaurant_subscriptions_source_check;

alter table public.restaurant_subscriptions
  add constraint restaurant_subscriptions_source_check
  check (source in ('stripe', 'mollie', 'manual', 'legacy', 'complimentary'));

alter table public.restaurant_subscriptions
  add column if not exists mollie_customer_id text;

alter table public.restaurant_subscriptions
  add column if not exists mollie_subscription_id text;

alter table public.restaurant_subscriptions
  add column if not exists mollie_mandate_id text;

create unique index if not exists restaurant_subscriptions_mollie_customer_uidx
  on public.restaurant_subscriptions (mollie_customer_id)
  where mollie_customer_id is not null;

create unique index if not exists restaurant_subscriptions_mollie_subscription_uidx
  on public.restaurant_subscriptions (mollie_subscription_id)
  where mollie_subscription_id is not null;

comment on table public.restaurant_subscriptions is
  'Gwada SaaS plan per restaurant (Mollie Subscriptions). POS is a separate add-on row.';

-- ---------------------------------------------------------------------------
-- restaurant_billing_invoices: Mollie payment id (Stripe id optional)
-- ---------------------------------------------------------------------------
alter table public.restaurant_billing_invoices
  alter column stripe_invoice_id drop not null;

alter table public.restaurant_billing_invoices
  add column if not exists mollie_payment_id text;

create unique index if not exists restaurant_billing_invoices_mollie_payment_uidx
  on public.restaurant_billing_invoices (mollie_payment_id)
  where mollie_payment_id is not null;

comment on table public.restaurant_billing_invoices is
  'SaaS invoices (Mollie payments; legacy Stripe ids retained).';

-- ---------------------------------------------------------------------------
-- Guest → restaurant online payments (deposits, links, orders)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_guest_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  purpose text not null default 'generic'
    check (purpose in ('deposit', 'order', 'payment_link', 'generic')),
  amount_value text not null,
  amount_currency text not null default 'EUR',
  description text not null,
  status text not null default 'open'
    check (status in (
      'open',
      'pending',
      'paid',
      'authorized',
      'failed',
      'canceled',
      'expired',
      'refunded'
    )),
  mollie_payment_id text,
  mollie_payment_link_id text,
  checkout_url text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists restaurant_guest_payments_mollie_payment_uidx
  on public.restaurant_guest_payments (mollie_payment_id)
  where mollie_payment_id is not null;

create index if not exists restaurant_guest_payments_restaurant_created_idx
  on public.restaurant_guest_payments (restaurant_id, created_at desc);

drop trigger if exists restaurant_guest_payments_set_updated_at
  on public.restaurant_guest_payments;
create trigger restaurant_guest_payments_set_updated_at
  before update on public.restaurant_guest_payments
  for each row execute function public.set_updated_at();

alter table public.restaurant_guest_payments enable row level security;

revoke all on table public.restaurant_guest_payments from public;
revoke all on table public.restaurant_guest_payments from anon;
revoke all on table public.restaurant_guest_payments from authenticated;
grant all on table public.restaurant_guest_payments to service_role;

-- ---------------------------------------------------------------------------
-- Accounting PSP: keep historical adyen rows readable; prefer mollie/other
-- ---------------------------------------------------------------------------
alter table public.accounting_psp_settlements
  drop constraint if exists accounting_psp_settlements_provider_check;

alter table public.accounting_psp_settlements
  add constraint accounting_psp_settlements_provider_check
  check (provider in ('mollie', 'adyen', 'other'));

-- ---------------------------------------------------------------------------
-- Superadmin subscriptions RPC: include Mollie ids
-- ---------------------------------------------------------------------------
drop function if exists public.superadmin_list_subscriptions();

create function public.superadmin_list_subscriptions()
returns table (
  restaurant_id uuid,
  restaurant_name text,
  restaurant_slug text,
  plan_id text,
  billing_interval text,
  status text,
  source text,
  stripe_customer_id text,
  stripe_subscription_id text,
  mollie_customer_id text,
  mollie_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  trial_ends_at timestamptz,
  notes text,
  has_pos boolean,
  pos_status text,
  pos_interval text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.auth_is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    r.id as restaurant_id,
    r.name as restaurant_name,
    r.slug as restaurant_slug,
    coalesce(rs.plan_id, 'free') as plan_id,
    coalesce(rs.interval, 'month') as billing_interval,
    coalesce(rs.status, 'active') as status,
    coalesce(rs.source, 'manual') as source,
    rs.stripe_customer_id,
    rs.stripe_subscription_id,
    rs.mollie_customer_id,
    rs.mollie_subscription_id,
    rs.current_period_start,
    rs.current_period_end,
    coalesce(rs.cancel_at_period_end, false) as cancel_at_period_end,
    rs.trial_ends_at,
    rs.notes,
    (rsa.addon_id is not null) as has_pos,
    rsa.status as pos_status,
    rsa.interval as pos_interval,
    coalesce(rs.created_at, r.created_at) as created_at,
    coalesce(rs.updated_at, r.created_at) as updated_at
  from public.restaurants r
  left join public.restaurant_subscriptions rs on rs.restaurant_id = r.id
  left join public.restaurant_subscription_addons rsa
    on rsa.restaurant_id = r.id
    and rsa.addon_id = 'pos'
    and rsa.status in ('active', 'legacy', 'past_due')
  order by r.name asc;
end;
$$;

revoke all on function public.superadmin_list_subscriptions() from public;
grant execute on function public.superadmin_list_subscriptions() to authenticated;
