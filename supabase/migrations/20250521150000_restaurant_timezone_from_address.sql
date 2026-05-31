-- Zeitzone aus Adresse (Einstellungen / restaurants); ohne Adresse → Europe/Berlin.

alter table public.restaurants
  alter column timezone set default 'Europe/Berlin';

create or replace function public.restaurant_timezone_from_address(
  p_country text,
  p_city text,
  p_street text,
  p_postal text
)
returns text
language plpgsql
immutable
as $$
declare
  c text;
  has_address boolean;
begin
  has_address := coalesce(
    nullif(trim(p_street), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_postal), '')
  ) is not null;

  if not has_address then
    return 'Europe/Berlin';
  end if;

  c := lower(trim(coalesce(p_country, '')));
  c := translate(c, 'äöüß', 'aous');

  if c in ('de', 'deutschland', 'germany') then return 'Europe/Berlin'; end if;
  if c in ('at', 'osterreich', 'austria') then return 'Europe/Vienna'; end if;
  if c in ('ch', 'schweiz', 'switzerland') then return 'Europe/Zurich'; end if;
  if c in ('fr', 'frankreich', 'france') then return 'Europe/Paris'; end if;
  if c in ('gp', 'guadeloupe') then return 'America/Guadeloupe'; end if;
  if c in ('mq', 'martinique') then return 'America/Martinique'; end if;
  if c in ('be', 'belgien', 'belgium') then return 'Europe/Brussels'; end if;
  if c in ('nl', 'niederlande', 'netherlands') then return 'Europe/Amsterdam'; end if;
  if c in ('lu', 'luxemburg', 'luxembourg') then return 'Europe/Luxembourg'; end if;
  if c in ('it', 'italien', 'italy') then return 'Europe/Rome'; end if;
  if c in ('es', 'spanien', 'spain') then return 'Europe/Madrid'; end if;
  if c in ('pt', 'portugal') then return 'Europe/Lisbon'; end if;
  if c in ('pl', 'polen', 'poland') then return 'Europe/Warsaw'; end if;
  if c in ('cz', 'tschechien', 'czechia') then return 'Europe/Prague'; end if;
  if c in ('dk', 'danemark', 'denmark') then return 'Europe/Copenhagen'; end if;
  if c in ('se', 'schweden', 'sweden') then return 'Europe/Stockholm'; end if;
  if c in ('no', 'norwegen', 'norway') then return 'Europe/Oslo'; end if;
  if c in ('gb', 'uk', 'vereinigtes konigreich', 'united kingdom') then return 'Europe/London'; end if;
  if c in ('ie', 'irland', 'ireland') then return 'Europe/Dublin'; end if;
  if c in ('us', 'usa', 'vereinigte staaten', 'united states') then return 'America/New_York'; end if;

  return 'Europe/Berlin';
end;
$$;

-- Bestehende Mandate aus App-State / Tabellenzeile korrigieren
update public.restaurants r
set
  country = coalesce(nullif(trim(prof.country), ''), r.country),
  address_line1 = coalesce(nullif(trim(prof.street), ''), r.address_line1),
  postal_code = coalesce(nullif(trim(prof.postal_code), ''), r.postal_code),
  city = coalesce(nullif(trim(prof.city), ''), r.city),
  timezone = public.restaurant_timezone_from_address(
    coalesce(nullif(trim(prof.country), ''), r.country),
    coalesce(nullif(trim(prof.city), ''), r.city),
    coalesce(nullif(trim(prof.street), ''), r.address_line1),
    coalesce(nullif(trim(prof.postal_code), ''), r.postal_code)
  ),
  updated_at = timezone('utc', now())
from (
  select
    ras.restaurant_id,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'street' as street,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'postalCode' as postal_code,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'city' as city,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'country' as country
  from public.restaurant_app_state ras
  where ras.storage_key = 'gwada-restaurant-profile-v1'
) prof
where r.id = prof.restaurant_id;

update public.restaurants r
set
  timezone = public.restaurant_timezone_from_address(
    r.country,
    r.city,
    r.address_line1,
    r.postal_code
  ),
  updated_at = timezone('utc', now())
where not exists (
  select 1
  from public.restaurant_app_state ras
  where ras.restaurant_id = r.id
    and ras.storage_key = 'gwada-restaurant-profile-v1'
);

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
    coalesce(
      nullif(trim(ras.payload -> 'restaurants' -> (r.id::text) ->> 'name'), ''),
      r.name
    ) as name,
    r.email,
    coalesce(
      nullif(trim(ras.payload -> 'restaurants' -> (r.id::text) ->> 'phone'), ''),
      r.phone
    ) as phone,
    public.restaurant_timezone_from_address(
      coalesce(
        nullif(trim(ras.payload -> 'restaurants' -> (r.id::text) ->> 'country'), ''),
        r.country
      ),
      coalesce(
        nullif(trim(ras.payload -> 'restaurants' -> (r.id::text) ->> 'city'), ''),
        r.city
      ),
      coalesce(
        nullif(trim(ras.payload -> 'restaurants' -> (r.id::text) ->> 'street'), ''),
        r.address_line1
      ),
      coalesce(
        nullif(trim(ras.payload -> 'restaurants' -> (r.id::text) ->> 'postalCode'), ''),
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
    r.created_at
  from public.restaurants r
  left join public.restaurant_app_state ras
    on ras.restaurant_id = r.id
   and ras.storage_key = 'gwada-restaurant-profile-v1'
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
