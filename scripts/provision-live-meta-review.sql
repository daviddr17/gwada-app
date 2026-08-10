-- Live: Meta App Review Demo — User + Restaurant OHNE Superadmin / OHNE WhatsApp/WAHA.
-- Idempotent.

create extension if not exists pgcrypto;

do $$
declare
  v_email text := 'meta-review@gwada.app';
  v_password text := 'MetaReview-Gwada-2026!';
  v_user_id uuid;
  v_rid uuid := 'a11e0000-1111-4111-8111-111111111101'::uuid;
  v_tz text := 'Europe/Berlin';
  pos_owner uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email) limit 1;

  if v_user_id is null then
    v_user_id := 'a11e0000-1111-4111-8111-111111111102'::uuid;
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"given_name":"Meta","family_name":"Reviewer","full_name":"Meta Reviewer"}'::jsonb,
      timezone('utc', now()), timezone('utc', now()),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', v_user_id::text,
      timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
    );
  else
    -- Passwort zurücksetzen (Review-Credentials stabil halten)
    update auth.users
    set
      encrypted_password = crypt(v_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
    where id = v_user_id;
  end if;

  insert into public.restaurants (
    id, slug, name, description, timezone,
    address_line1, city, postal_code, country,
    phone, email, owner_profile_id, is_published
  ) values (
    v_rid,
    'gwada-meta-review-demo',
    'Gwada Meta Review Demo',
    'Demo workspace for Meta App Review (Facebook Page + Instagram Business only). No WhatsApp.',
    v_tz,
    'Review Street 1', 'Berlin', '10115', 'DE',
    '+493000000000', v_email, v_user_id, true
  )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    timezone = excluded.timezone,
    address_line1 = excluded.address_line1,
    city = excluded.city,
    postal_code = excluded.postal_code,
    country = excluded.country,
    phone = excluded.phone,
    email = excluded.email,
    owner_profile_id = excluded.owner_profile_id,
    is_published = excluded.is_published,
    updated_at = timezone('utc', now());

  select id into v_rid from public.restaurants where slug = 'gwada-meta-review-demo' limit 1;

  insert into public.profiles (id, display_name, locale, given_name, family_name)
  values (v_user_id, 'Meta Reviewer', 'en-US', 'Meta', 'Reviewer')
  on conflict (id) do update set
    display_name = excluded.display_name,
    given_name = excluded.given_name,
    family_name = excluded.family_name,
    locale = excluded.locale,
    active_restaurant_id = v_rid,
    updated_at = timezone('utc', now());

  update public.profiles
  set active_restaurant_id = v_rid, updated_at = timezone('utc', now())
  where id = v_user_id;

  insert into public.restaurant_employees (restaurant_id, profile_id, role, is_active)
  values (v_rid, v_user_id, 'owner', true)
  on conflict (restaurant_id, profile_id) do update set
    role = 'owner', is_active = true;

  -- Explizit KEIN platform_superadmins (sonst WAHA-Menü sichtbar)

  perform public.seed_restaurant_default_positions(v_rid);

  insert into public.restaurant_menu_settings (restaurant_id, currency_code)
  values (v_rid, 'EUR')
  on conflict (restaurant_id) do update set currency_code = 'EUR';

  insert into public.restaurant_reservation_settings (restaurant_id)
  values (v_rid)
  on conflict (restaurant_id) do nothing;

  -- Pro complimentary — Meta-Features ohne Stripe
  insert into public.restaurant_subscriptions (
    restaurant_id, plan_id, interval, status, source
  ) values (
    v_rid, 'pro', 'month', 'active', 'complimentary'
  )
  on conflict (restaurant_id) do update set
    plan_id = 'pro',
    interval = 'month',
    status = 'active',
    source = 'complimentary',
    updated_at = timezone('utc', now());

  select id into pos_owner from public.restaurant_positions
  where restaurant_id = v_rid and name ilike '%Inhaber%' limit 1;

  insert into public.restaurant_staff (
    id, restaurant_id, profile_id, given_name, family_name,
    email, phone, restaurant_position_id, is_active
  ) values (
    'a11e0000-1111-4111-8111-111111111103'::uuid,
    v_rid, v_user_id, 'Meta', 'Reviewer', v_email, null, pos_owner, true
  )
  on conflict (id) do update set
    profile_id = excluded.profile_id,
    restaurant_position_id = excluded.restaurant_position_id,
    is_active = true;

  -- Keine WhatsApp-Integration / WAHA-Anbindung
  delete from public.restaurant_integrations
  where restaurant_id = v_rid
    and integration_key = 'whatsapp';

  raise notice 'provision-meta-review: OK user=% restaurant=% email=%', v_user_id, v_rid, v_email;
end $$;
