-- Platform superadmin + integration settings (UI-managed secrets).

-- ---------------------------------------------------------------------------
-- Superadmins
-- ---------------------------------------------------------------------------
create table public.platform_superadmins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_superadmins enable row level security;

create or replace function public.auth_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_superadmins s
    where s.profile_id = auth.uid()
  );
$$;

revoke all on function public.auth_is_superadmin() from public;
grant execute on function public.auth_is_superadmin() to authenticated;

create policy platform_superadmins_select_self
  on public.platform_superadmins
  for select
  to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Integration settings (OAuth etc.)
-- ---------------------------------------------------------------------------
create table public.platform_integrations (
  key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger platform_integrations_set_updated_at
  before update on public.platform_integrations
  for each row execute function public.set_updated_at();

alter table public.platform_integrations enable row level security;

create policy platform_integrations_superadmin_all
  on public.platform_integrations
  for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

insert into public.platform_integrations (key, enabled, config)
values
  ('google_oauth', false, '{}'::jsonb),
  ('apple_oauth', false, '{}'::jsonb),
  ('facebook', false, '{}'::jsonb),
  ('instagram', false, '{}'::jsonb),
  ('whatsapp', false, '{}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Superadmin RPC: users
-- ---------------------------------------------------------------------------
create or replace function public.superadmin_list_users()
returns table (
  profile_id uuid,
  email text,
  given_name text,
  family_name text,
  display_name text,
  phone text,
  locale text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  restaurant_count bigint
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
    p.id as profile_id,
    u.email::text as email,
    p.given_name,
    p.family_name,
    p.display_name,
    p.phone,
    p.locale,
    p.created_at,
    u.last_sign_in_at,
    coalesce(ec.cnt, 0)::bigint as restaurant_count
  from public.profiles p
  inner join auth.users u on u.id = p.id
  left join lateral (
    select count(*)::bigint as cnt
    from public.restaurant_employees re
    where re.profile_id = p.id
      and re.is_active = true
  ) ec on true
  order by p.created_at desc;
end;
$$;

revoke all on function public.superadmin_list_users() from public;
grant execute on function public.superadmin_list_users() to authenticated;

-- ---------------------------------------------------------------------------
-- Superadmin RPC: restaurants
-- ---------------------------------------------------------------------------
create or replace function public.superadmin_list_restaurants()
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
  created_at timestamptz
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
    r.timezone,
    r.is_published,
    r.brand_accent_hex,
    ou.email::text as owner_email,
    coalesce(
      nullif(trim(concat_ws(' ', op.given_name, op.family_name)), ''),
      op.display_name
    ) as owner_display_name,
    coalesce(ec.cnt, 0)::bigint as employee_count,
    r.created_at
  from public.restaurants r
  left join public.profiles op on op.id = r.owner_profile_id
  left join auth.users ou on ou.id = r.owner_profile_id
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
-- Seed: dreyer@techlion.de
-- ---------------------------------------------------------------------------
insert into public.platform_superadmins (profile_id)
select u.id
from auth.users u
where u.email = 'dreyer@techlion.de'
on conflict (profile_id) do nothing;
