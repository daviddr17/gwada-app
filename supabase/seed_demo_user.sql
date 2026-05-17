-- Demo account for local development (runs as DB superuser — RLS bypassed).
-- Login: dreyer@techlion.de / GwadaLocal2026!
-- Depends on public.restaurants slug gwada-demo (seed.sql).

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid := 'a1b2c3d4-e5f6-4789-a012-3456789abcde'::uuid;
  v_demo_restaurant_id uuid;
  v_encrypted_pw text := crypt('GwadaLocal2026!', gen_salt('bf'));
begin
  select id into v_demo_restaurant_id
  from public.restaurants
  where slug = 'gwada-demo'
  limit 1;

  if v_demo_restaurant_id is null then
    raise notice 'seed_demo_user: no gwada-demo restaurant, skip';
    return;
  end if;

  if exists (select 1 from auth.users where id = v_user_id or email = 'dreyer@techlion.de') then
    raise notice 'seed_demo_user: user already exists, skip';
    return;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token
  )
  values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dreyer@techlion.de',
    v_encrypted_pw,
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Tech Lion"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', 'dreyer@techlion.de'
    ),
    'email',
    v_user_id::text,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  update public.profiles
  set
    given_name = 'Tech',
    family_name = 'Lion',
    birth_date = '1992-04-29',
    address_line1 = 'Im Steinbachshofe 14',
    address_line2 = null,
    address_city = 'Berkatal',
    address_postal_code = '37297',
    address_country = 'DE',
    display_name = 'Tech Lion',
    active_restaurant_id = v_demo_restaurant_id,
    locale = 'de-DE'
  where id = v_user_id;

  insert into public.restaurant_employees (
    restaurant_id,
    profile_id,
    role,
    is_active
  )
  values (
    v_demo_restaurant_id,
    v_user_id,
    'owner',
    true
  )
  on conflict (restaurant_id, profile_id) do nothing;
end $$;
