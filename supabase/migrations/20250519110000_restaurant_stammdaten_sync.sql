-- Spiegeln von App-Stammdaten (restaurant_app_state) nach public.restaurants + Superadmin-Anzeige.

-- Einmaliges Backfill aus gespeichertem Profil-JSON
update public.restaurants r
set
  name = coalesce(nullif(trim(prof.name), ''), r.name),
  address_line1 = coalesce(nullif(trim(prof.street), ''), r.address_line1),
  postal_code = coalesce(nullif(trim(prof.postal_code), ''), r.postal_code),
  city = coalesce(nullif(trim(prof.city), ''), r.city),
  country = coalesce(nullif(trim(prof.country), ''), r.country),
  phone = coalesce(nullif(trim(prof.phone), ''), r.phone),
  updated_at = timezone('utc', now())
from (
  select
    ras.restaurant_id,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'name' as name,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'street' as street,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'postalCode' as postal_code,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'city' as city,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'country' as country,
    ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'phone' as phone
  from public.restaurant_app_state ras
  where ras.storage_key = 'gwada-restaurant-profile-v1'
) prof
where r.id = prof.restaurant_id
  and prof.name is not null
  and trim(prof.name) <> '';

-- Superadmin-Liste: Anzeigename aus App-State, falls gesetzt
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
    coalesce(
      nullif(trim(ras.payload -> 'restaurants' -> (r.id::text) ->> 'name'), ''),
      r.name
    ) as name,
    r.email,
    coalesce(
      nullif(trim(ras.payload -> 'restaurants' -> (r.id::text) ->> 'phone'), ''),
      r.phone
    ) as phone,
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
