-- Profilnamen liegen oft unter selectedRestaurantId "default", nicht unter der Restaurant-UUID.

create or replace function public.app_state_profile_name(
  p_payload jsonb,
  p_restaurant_id uuid
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(p_payload -> 'restaurants' -> (p_restaurant_id::text) ->> 'name'), ''),
    nullif(trim(
      p_payload -> 'restaurants' -> (p_payload ->> 'selectedRestaurantId') ->> 'name'
    ), ''),
    nullif(trim(p_payload -> 'restaurants' -> 'default' ->> 'name'), '')
  );
$$;

-- Backfill relational name + contact from app state (alle JSON-Schlüssel)
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
    coalesce(
      public.app_state_profile_name(ras.payload, ras.restaurant_id),
      ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'name',
      ras.payload -> 'restaurants' -> (ras.payload ->> 'selectedRestaurantId') ->> 'name',
      ras.payload -> 'restaurants' -> 'default' ->> 'name'
    ) as name,
    coalesce(
      ras.payload -> 'restaurants' -> (ras.payload ->> 'selectedRestaurantId') ->> 'street',
      ras.payload -> 'restaurants' -> 'default' ->> 'street',
      ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'street'
    ) as street,
    coalesce(
      ras.payload -> 'restaurants' -> (ras.payload ->> 'selectedRestaurantId') ->> 'postalCode',
      ras.payload -> 'restaurants' -> 'default' ->> 'postalCode',
      ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'postalCode'
    ) as postal_code,
    coalesce(
      ras.payload -> 'restaurants' -> (ras.payload ->> 'selectedRestaurantId') ->> 'city',
      ras.payload -> 'restaurants' -> 'default' ->> 'city',
      ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'city'
    ) as city,
    coalesce(
      ras.payload -> 'restaurants' -> (ras.payload ->> 'selectedRestaurantId') ->> 'country',
      ras.payload -> 'restaurants' -> 'default' ->> 'country',
      ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'country'
    ) as country,
    coalesce(
      ras.payload -> 'restaurants' -> (ras.payload ->> 'selectedRestaurantId') ->> 'phone',
      ras.payload -> 'restaurants' -> 'default' ->> 'phone',
      ras.payload -> 'restaurants' -> (ras.restaurant_id::text) ->> 'phone'
    ) as phone
  from public.restaurant_app_state ras
  where ras.storage_key = 'gwada-restaurant-profile-v1'
) prof
where r.id = prof.restaurant_id
  and prof.name is not null
  and trim(prof.name) <> ''
  and trim(prof.name) <> 'Mein Restaurant';

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
      public.app_state_profile_name(ras.payload, r.id),
      r.name
    ) as name,
    r.email,
    coalesce(
      nullif(trim(
        coalesce(
          ras.payload -> 'restaurants' -> (ras.payload ->> 'selectedRestaurantId') ->> 'phone',
          ras.payload -> 'restaurants' -> 'default' ->> 'phone'
        )
      ), ''),
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
