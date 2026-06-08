-- Live-only: Demo-Restaurant „Fadis BurgerStation“ + User Fadi Hanna (fadih32@gmail.com).
-- Idempotent. Kein Löschen anderer Restaurants.

create extension if not exists pgcrypto;

do $$
declare
  v_email text := 'fadih32@gmail.com';
  v_user_id uuid;
  v_rid uuid := 'fad22222-2222-4222-8222-burger0001'::uuid;
  v_tz text := 'Europe/Berlin';
  v_local_today date;
  st_pending uuid;
  st_confirmed uuid;
  st_cancelled uuid;
  pos_owner uuid;
  pos_kitchen uuid;
  pos_service uuid;
  tag_grill uuid := 'fad33333-3333-4333-8333-taggrill01'::uuid;
  tag_service uuid := 'fad33333-3333-4333-8333-tagservi01'::uuid;
  staff_fadi uuid := 'fad44444-4444-4444-8444-stafffadi01'::uuid;
  staff_grill uuid := 'fad44444-4444-4444-8444-staffgril01'::uuid;
  staff_service uuid := 'fad44444-4444-4444-8444-staffserv01'::uuid;
  res1 uuid := 'fad55555-5555-4555-8555-reserv0001'::uuid;
  res2 uuid := 'fad55555-5555-4555-8555-reserv0002'::uuid;
  res3 uuid := 'fad55555-5555-4555-8555-reserv0003'::uuid;
  res4 uuid := 'fad55555-5555-4555-8555-reserv0004'::uuid;
  inv1 uuid := 'fad66666-6666-4666-8666-invit0001'::uuid;
  inv2 uuid := 'fad66666-6666-4666-8666-invit0002'::uuid;
  inv3 uuid := 'fad66666-6666-4666-8666-invit0003'::uuid;
  inv4 uuid := 'fad66666-6666-4666-8666-invit0004'::uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email) limit 1;

  if v_user_id is null then
    v_user_id := 'fad11111-1111-4111-8111-fadih320001'::uuid;
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
      crypt('GwadaLiveProvision2026!', gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"given_name":"Fadi","family_name":"Hanna","full_name":"Fadi Hanna"}'::jsonb,
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
  end if;

  insert into public.restaurants (
    id, slug, name, description, timezone,
    address_line1, city, postal_code, country,
    phone, email, owner_profile_id, is_published
  ) values (
    v_rid,
    'fadis-burgerstation',
    'Fadis BurgerStation',
    'Smash Burger, handgemachte Fries und hausgemachte Sauces — mitten in der Stadt. Perfekt für schnellen Lunch oder entspannten Abend mit Freunden.',
    v_tz,
    'Bergmannstraße 12', 'Berlin', '10961', 'DE',
    '+493012345678', v_email, v_user_id, true
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

  select id into v_rid from public.restaurants where slug = 'fadis-burgerstation' limit 1;

  insert into public.profiles (id, display_name, locale, given_name, family_name)
  values (v_user_id, 'Fadi Hanna', 'de-DE', 'Fadi', 'Hanna')
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

  insert into public.platform_superadmins (profile_id)
  values (v_user_id)
  on conflict (profile_id) do nothing;

  perform public.seed_restaurant_default_positions(v_rid);

  insert into public.restaurant_menu_settings (restaurant_id, currency_code)
  values (v_rid, 'EUR')
  on conflict (restaurant_id) do update set currency_code = 'EUR';

  insert into public.restaurant_reservation_settings (restaurant_id)
  values (v_rid)
  on conflict (restaurant_id) do nothing;

  -- Speisekarte
  insert into public.menu_categories (id, restaurant_id, name, sort_order, is_active) values
    ('fad77777-7777-4777-8777-catburger01', v_rid, 'Burger', 0, true),
    ('fad77777-7777-4777-8777-catside001', v_rid, 'Beilagen', 1, true),
    ('fad77777-7777-4777-8777-catdrink01', v_rid, 'Getränke', 2, true),
    ('fad77777-7777-4777-8777-catdess001', v_rid, 'Desserts', 3, true)
  on conflict (id) do nothing;

  insert into public.menu_tags (id, restaurant_id, name, background_color, sort_order, is_active) values
    ('fad88888-8888-4888-8888-tagvegan01', v_rid, 'Vegan', '#059669', 0, true),
    ('fad88888-8888-4888-8888-tagspicy01', v_rid, 'Spicy', '#ea580c', 1, true),
    ('fad88888-8888-4888-8888-tagbests01', v_rid, 'Bestseller', '#ca8a04', 2, true)
  on conflict (id) do nothing;

  insert into public.menu_allergens (id, restaurant_id, name, background_color, sort_order, is_active) values
    ('fad99999-9999-4999-8999-allgluten1', v_rid, 'Gluten', '#d97706', 0, true),
    ('fad99999-9999-4999-8999-allmilch01', v_rid, 'Milch', '#0284c7', 1, true),
    ('fad99999-9999-4999-8999-allsesam01', v_rid, 'Sesam', '#ca8a04', 2, true)
  on conflict (id) do nothing;

  insert into public.menu_items (id, restaurant_id, category_id, name, description, price, image_url, is_active) values
    ('fadaaaaa-aaaa-4aaa-8aaa-item00001', v_rid, 'fad77777-7777-4777-8777-catburger01', 'Classic Smash', 'Doppelter Rindfleisch-Patty, Cheddar, Haus-Sauce, Salat, Tomate, Brioche-Bun.', 12.9, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', true),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00002', v_rid, 'fad77777-7777-4777-8777-catburger01', 'BBQ Bacon Station', 'Smash-Patty, knuspriger Bacon, BBQ-Glasur, Röstzwiebeln, Cheddar.', 14.5, 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800&q=80', true),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00003', v_rid, 'fad77777-7777-4777-8777-catburger01', 'Green Garden Burger', 'Beyond-Patty, Avocado, Rucola, veganes Aioli — komplett pflanzlich.', 13.9, 'https://images.unsplash.com/photo-1520072959219-c480dc77466a?w=800&q=80', true),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00004', v_rid, 'fad77777-7777-4777-8777-catburger01', 'Chili Cheese Melt', 'Doppel-Cheddar, Jalapeños, Chipotle-Mayo — scharf & cremig.', 13.5, 'https://images.unsplash.com/photo-1594212699903-ec8a3eca094f?w=800&q=80', true),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00005', v_rid, 'fad77777-7777-4777-8777-catside001', 'Truffle Fries', 'Handgeschnittene Fries mit Trüffelöl, Parmesan und Kräutersalz.', 6.9, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80', true),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00006', v_rid, 'fad77777-7777-4777-8777-catside001', 'Onion Rings', 'Knusprig paniert, mit Ranch-Dip.', 5.5, 'https://images.unsplash.com/photo-1639024471283-03518883512f?w=800&q=80', true),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00007', v_rid, 'fad77777-7777-4777-8777-catdrink01', 'Craft Cola', 'Hausgemachte Cola mit Limette & Rohrzucker.', 3.9, 'https://images.unsplash.com/photo-1629203851122-3726d08c1614?w=800&q=80', true),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00008', v_rid, 'fad77777-7777-4777-8777-catdrink01', 'Milkshake Vanille', 'Cremig, mit echter Vanille und Sahnehaube.', 5.9, 'https://images.unsplash.com/photo-1572490122747-3969b75c99cf?w=800&q=80', true),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00009', v_rid, 'fad77777-7777-4777-8777-catdess001', 'Brownie Sundae', 'Warmes Brownie mit Vanilleeis und Karamell.', 7.5, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80', true)
  on conflict (id) do nothing;

  insert into public.menu_item_tags (menu_item_id, tag_id) values
    ('fadaaaaa-aaaa-4aaa-8aaa-item00001', 'fad88888-8888-4888-8888-tagbests01'),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00002', 'fad88888-8888-4888-8888-tagbests01'),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00003', 'fad88888-8888-4888-8888-tagvegan01'),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00004', 'fad88888-8888-4888-8888-tagspicy01')
  on conflict (menu_item_id, tag_id) do nothing;

  insert into public.menu_item_allergens (menu_item_id, allergen_id) values
    ('fadaaaaa-aaaa-4aaa-8aaa-item00001', 'fad99999-9999-4999-8999-allgluten1'),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00001', 'fad99999-9999-4999-8999-allmilch01'),
    ('fadaaaaa-aaaa-4aaa-8aaa-item00001', 'fad99999-9999-4999-8999-allsesam01')
  on conflict (menu_item_id, allergen_id) do nothing;

  -- Bestand
  insert into public.inventory_suppliers (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'fbs-sup-metro', 'Metro Großhandel', 0, true),
    (v_rid, 'fbs-sup-local', 'Biohof Brandenburg', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_ingredient_categories (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'fbs-cat-meat', 'Fleisch & Patties', 0, true),
    (v_rid, 'fbs-cat-fresh', 'Frische Ware', 1, true),
    (v_rid, 'fbs-cat-dry', 'Trocken & Saucen', 2, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_production_sites (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'fbs-ps-grill', 'Grill-Station', 0, true),
    (v_rid, 'fbs-ps-prep', 'Vorbereitung', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_brands (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'fbs-br-house', 'BurgerStation Haus', 0, true),
    (v_rid, 'fbs-br-import', 'Import', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_units (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'g', 'Gramm (g)', 0, true),
    (v_rid, 'l', 'Liter (l)', 1, true),
    (v_rid, 'stk', 'Stück', 2, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_ingredients (
    restaurant_id, id, name, unit, current_stock,
    supplier_id, category_id, production_site_id, brand_id, is_active
  ) values
    (v_rid, 'fbs-ing-beef', 'Rinderhack 80/20', 'g', 18000, 'fbs-sup-metro', 'fbs-cat-meat', 'fbs-ps-grill', 'fbs-br-house', true),
    (v_rid, 'fbs-ing-bun', 'Brioche-Buns', 'stk', 120, 'fbs-sup-local', 'fbs-cat-dry', 'fbs-ps-prep', 'fbs-br-house', true),
    (v_rid, 'fbs-ing-cheddar', 'Cheddar-Scheiben', 'g', 3200, 'fbs-sup-metro', 'fbs-cat-fresh', 'fbs-ps-prep', 'fbs-br-import', true),
    (v_rid, 'fbs-ing-fries', 'Pommes TK', 'g', 25000, 'fbs-sup-metro', 'fbs-cat-fresh', 'fbs-ps-grill', 'fbs-br-import', true),
    (v_rid, 'fbs-ing-sauce', 'Haus-Sauce Basis', 'l', 8, 'fbs-sup-local', 'fbs-cat-dry', 'fbs-ps-prep', 'fbs-br-house', true)
  on conflict (restaurant_id, id) do nothing;

  -- Mitarbeiter
  insert into public.restaurant_staff_position_tags (id, restaurant_id, name, background_color, sort_order, is_active) values
    (tag_grill, v_rid, 'Grill', '#ea580c', 0, true),
    (tag_service, v_rid, 'Service', '#0284c7', 1, true)
  on conflict (id) do nothing;

  select id into pos_owner from public.restaurant_positions
  where restaurant_id = v_rid and name ilike '%Inhaber%' limit 1;
  select id into pos_kitchen from public.restaurant_positions
  where restaurant_id = v_rid and name ilike '%Küche%' limit 1;
  select id into pos_service from public.restaurant_positions
  where restaurant_id = v_rid and (name ilike '%Service%' or name ilike '%Gastgeber%') limit 1;

  insert into public.restaurant_staff (
    id, restaurant_id, profile_id, given_name, family_name,
    email, phone, position_tag_id, restaurant_position_id, is_active
  ) values
    (staff_fadi, v_rid, v_user_id, 'Fadi', 'Hanna', v_email, '+493012345678', tag_grill, pos_owner, true),
    (staff_grill, v_rid, null, 'Lukas', 'Meier', 'lukas.meier@burgerstation.demo', '+491701234567', tag_grill, pos_kitchen, true),
    (staff_service, v_rid, null, 'Sara', 'Yilmaz', 'sara.yilmaz@burgerstation.demo', '+491709876543', tag_service, pos_service, true)
  on conflict (id) do update set
    profile_id = excluded.profile_id,
    is_active = true;

  -- Reservierungen
  v_local_today := (timezone(v_tz, now()))::date;
  select id into st_pending from public.reservation_statuses where code = 'pending' limit 1;
  select id into st_confirmed from public.reservation_statuses where code = 'confirmed' limit 1;
  select id into st_cancelled from public.reservation_statuses where code = 'cancelled' limit 1;

  insert into public.restaurant_reservation_counters (restaurant_id, next_number)
  values (v_rid, 10)
  on conflict (restaurant_id) do nothing;

  insert into public.reservations (
    id, restaurant_id, reservation_number,
    guest_first_name, guest_last_name, guest_phone, guest_email,
    party_size, starts_at, ends_at, status_id,
    guest_pin, notify_email, notify_whatsapp, terms_accepted, notes
  ) values
    (res1, v_rid, 1, 'Tim', 'Schneider', '+4915112345678', 'tim.schneider@example.com', 2,
      (v_local_today + time '12:00')::timestamp at time zone v_tz,
      (v_local_today + time '13:30')::timestamp at time zone v_tz,
      st_confirmed, '482901', true, true, true, 'provision:fadi'),
    (res2, v_rid, 2, 'Julia', 'Kraft', '+4916012345678', 'julia.kraft@example.com', 4,
      (v_local_today + time '18:30')::timestamp at time zone v_tz,
      (v_local_today + time '20:30')::timestamp at time zone v_tz,
      st_pending, '193847', true, false, true, 'provision:fadi'),
    (res3, v_rid, 3, 'Markus', 'Lehmann', '+4917112345678', 'markus.lehmann@example.com', 3,
      ((v_local_today + 1) + time '19:00')::timestamp at time zone v_tz,
      ((v_local_today + 1) + time '21:00')::timestamp at time zone v_tz,
      st_confirmed, '550012', true, true, true, 'provision:fadi'),
    (res4, v_rid, 4, 'Elena', 'Vogt', '+4915212345678', 'elena.vogt@example.com', 2,
      ((v_local_today - 3) + time '20:00')::timestamp at time zone v_tz,
      ((v_local_today - 3) + time '22:00')::timestamp at time zone v_tz,
      st_cancelled, '770043', false, false, true, 'provision:fadi')
  on conflict (id) do nothing;

  -- Bewertungen (Gwada)
  insert into public.gwada_review_invitations (id, restaurant_id, reservation_id, token, expires_at, completed_at)
  values
    (inv1, v_rid, res1, 'fadi-review-token-0001', timezone('utc', now()) + interval '30 days', timezone('utc', now()) - interval '2 days'),
    (inv2, v_rid, res3, 'fadi-review-token-0002', timezone('utc', now()) + interval '30 days', timezone('utc', now()) - interval '1 day'),
    (inv3, v_rid, res2, 'fadi-review-token-0003', timezone('utc', now()) + interval '30 days', null),
    (inv4, v_rid, res4, 'fadi-review-token-0004', timezone('utc', now()) + interval '30 days', timezone('utc', now()) - interval '5 days')
  on conflict (id) do nothing;

  insert into public.gwada_reviews (id, restaurant_id, reservation_id, invitation_id, rating, comment, guest_display_name, created_at)
  values
    ('fadbbbb-bbbb-4bbb-8bbb-rev000001', v_rid, res1, inv1, 5, 'Bester Smash Burger in Kreuzberg! Super schneller Service.', 'Tim Schneider', timezone('utc', now()) - interval '2 days'),
    ('fadbbbb-bbbb-4bbb-8bbb-rev000002', v_rid, res3, inv2, 4, 'Leckere Fries, etwas voll am Abend — trotzdem top.', 'Markus Lehmann', timezone('utc', now()) - interval '1 day'),
    ('fadbbbb-bbbb-4bbb-8bbb-rev000003', v_rid, res4, inv4, 5, 'BBQ Bacon Station ist der Hammer. Komme wieder!', 'Elena Vogt', timezone('utc', now()) - interval '5 days')
  on conflict (id) do nothing;

  raise notice 'provision-fadis: OK user=% restaurant=%', v_user_id, v_rid;
end $$;
