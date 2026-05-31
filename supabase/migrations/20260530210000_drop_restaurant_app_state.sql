-- Legacy JSON-Cache entfernen: Stammdaten, Menü, Bestand und Widgets liegen relational.

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

drop function if exists public.app_state_profile_name(jsonb, uuid);

drop trigger if exists restaurant_app_state_set_updated_at on public.restaurant_app_state;
drop policy if exists "restaurant_app_state_staff_all" on public.restaurant_app_state;
drop table if exists public.restaurant_app_state;
