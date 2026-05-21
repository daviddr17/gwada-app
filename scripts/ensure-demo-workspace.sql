-- Restaurant + Mitarbeiter für bestehenden Demo-User (nach Auth-Sync auf Live).
-- Idempotent. Login: dreyer@techlion.de

do $$
declare
  v_user_id uuid;
  v_rid uuid;
begin
  select id into v_user_id
  from auth.users
  where email = 'dreyer@techlion.de'
  limit 1;

  select id into v_rid
  from public.restaurants
  where slug = 'gwada-demo'
  limit 1;

  if v_user_id is null then
    raise notice 'ensure-demo-workspace: auth user dreyer@techlion.de fehlt';
    return;
  end if;

  if v_rid is null then
    raise notice 'ensure-demo-workspace: restaurant gwada-demo fehlt — zuerst public sync';
    return;
  end if;

  insert into public.profiles (id, display_name, locale)
  values (v_user_id, 'Tech Lion', 'de-DE')
  on conflict (id) do update
  set display_name = excluded.display_name,
      locale = excluded.locale,
      updated_at = timezone('utc', now());

  update public.profiles
  set
    given_name = coalesce(given_name, 'Tech'),
    family_name = coalesce(family_name, 'Lion'),
    active_restaurant_id = v_rid,
    updated_at = timezone('utc', now())
  where id = v_user_id;

  insert into public.restaurant_employees (
    restaurant_id,
    profile_id,
    role,
    is_active
  )
  values (v_rid, v_user_id, 'owner', true)
  on conflict (restaurant_id, profile_id) do update
  set role = excluded.role,
      is_active = true;

  insert into public.platform_superadmins (profile_id)
  values (v_user_id)
  on conflict (profile_id) do nothing;
end $$;
