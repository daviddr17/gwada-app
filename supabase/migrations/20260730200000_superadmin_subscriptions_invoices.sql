-- Superadmin: Abo-Felder in Restaurant-Liste + Billing-Rechnungen + Subscriptions-RPC

-- ---------------------------------------------------------------------------
-- Stripe invoices (SaaS payments) for Superadmin Zahlungen / Stats
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete set null,
  stripe_invoice_id text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null
    check (status in (
      'draft',
      'open',
      'paid',
      'uncollectible',
      'void',
      'payment_failed'
    )),
  billing_reason text,
  currency text not null default 'eur',
  amount_due integer not null default 0,
  amount_paid integer not null default 0,
  amount_remaining integer not null default 0,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  hosted_invoice_url text,
  invoice_pdf text,
  stripe_created_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  unique (stripe_invoice_id)
);

create index if not exists restaurant_billing_invoices_restaurant_idx
  on public.restaurant_billing_invoices (restaurant_id);

create index if not exists restaurant_billing_invoices_paid_at_idx
  on public.restaurant_billing_invoices (paid_at desc nulls last);

create index if not exists restaurant_billing_invoices_status_idx
  on public.restaurant_billing_invoices (status);

comment on table public.restaurant_billing_invoices is
  'Stripe SaaS invoices synced via webhook / Superadmin sync for payment stats.';

alter table public.restaurant_billing_invoices enable row level security;

drop policy if exists restaurant_billing_invoices_superadmin_all
  on public.restaurant_billing_invoices;
create policy restaurant_billing_invoices_superadmin_all
  on public.restaurant_billing_invoices for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

revoke all on table public.restaurant_billing_invoices from public;
grant select, insert, update, delete on table public.restaurant_billing_invoices
  to authenticated;
grant all on table public.restaurant_billing_invoices to service_role;

-- ---------------------------------------------------------------------------
-- Restaurant list: include plan fields
-- ---------------------------------------------------------------------------
drop function if exists public.superadmin_list_restaurants();

create function public.superadmin_list_restaurants()
returns table (
  id uuid,
  slug text,
  name text,
  email text,
  phone text,
  timezone text,
  is_published boolean,
  brand_accent_hex text,
  owner_email text,
  owner_display_name text,
  employee_count bigint,
  created_at timestamptz,
  plan_id text,
  plan_status text,
  plan_source text,
  plan_interval text,
  has_pos_addon boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.auth_is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.slug,
    r.name,
    r.email,
    r.phone,
    coalesce(
      nullif(trim(r.timezone), ''),
      public.restaurant_timezone_from_address(
        r.country,
        r.city,
        r.address_line1,
        r.postal_code
      )
    ) as timezone,
    r.is_published,
    r.brand_accent_hex,
    ou.email::text as owner_email,
    coalesce(
      nullif(trim(concat_ws(' ', op.given_name, op.family_name)), ''),
      op.display_name
    ) as owner_display_name,
    coalesce(ec.cnt, 0)::bigint as employee_count,
    r.created_at,
    coalesce(rs.plan_id, 'free') as plan_id,
    coalesce(rs.status, 'active') as plan_status,
    coalesce(rs.source, 'manual') as plan_source,
    coalesce(rs.interval, 'month') as plan_interval,
    exists (
      select 1
      from public.restaurant_subscription_addons rsa
      where rsa.restaurant_id = r.id
        and rsa.addon_id = 'pos'
        and rsa.status in ('active', 'legacy', 'past_due')
    ) as has_pos_addon
  from public.restaurants r
  left join public.profiles op on op.id = r.owner_profile_id
  left join auth.users ou on ou.id = r.owner_profile_id
  left join public.restaurant_subscriptions rs on rs.restaurant_id = r.id
  left join lateral (
    select count(*)::bigint as cnt
    from public.restaurant_employees re
    where re.restaurant_id = r.id
      and re.is_active = true
  ) ec on true
  order by r.created_at desc;
end;
$$;

revoke all on function public.superadmin_list_restaurants() from public;
grant execute on function public.superadmin_list_restaurants() to authenticated;

-- ---------------------------------------------------------------------------
-- Subscriptions list for Abonnements module
-- ---------------------------------------------------------------------------
create or replace function public.superadmin_list_subscriptions()
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
