-- Live-only: Messe-Demo „Die Salzkante“ + Owner messe@gwada.de.
-- Idempotent. Kein Löschen anderer Restaurants (Zur Schlagd unberührt).
-- Niche: Moderne Nordseeküche / Hamburg-Altona.

create extension if not exists pgcrypto;

do $$
declare
  v_email text := 'messe@gwada.de';
  v_password text := 'Salzkante-Messe-2026!Gwada';
  v_user_id uuid;
  v_rid uuid := 'a55c0001-5a17-4a17-8a17-c00000000001'::uuid;
  v_tz text := 'Europe/Berlin';
  v_local_today date;
  st_pending uuid;
  st_confirmed uuid;
  st_cancelled uuid;
  st_seated uuid;
  pos_owner uuid;
  pos_kitchen uuid;
  pos_service uuid;
  pos_host uuid;
  tag_kitchen uuid := 'a55c0001-5a17-4a17-8a17-c00000000010'::uuid;
  tag_service uuid := 'a55c0001-5a17-4a17-8a17-c00000000011'::uuid;
  tag_host uuid := 'a55c0001-5a17-4a17-8a17-c00000000012'::uuid;
  staff_owner uuid := 'a55c0001-5a17-4a17-8a17-c00000000020'::uuid;
  staff_kitchen uuid := 'a55c0001-5a17-4a17-8a17-c00000000021'::uuid;
  staff_service uuid := 'a55c0001-5a17-4a17-8a17-c00000000022'::uuid;
  staff_host uuid := 'a55c0001-5a17-4a17-8a17-c00000000023'::uuid;
  res1 uuid := 'a55c0001-5a17-4a17-8a17-c00000000030'::uuid;
  res2 uuid := 'a55c0001-5a17-4a17-8a17-c00000000031'::uuid;
  res3 uuid := 'a55c0001-5a17-4a17-8a17-c00000000032'::uuid;
  res4 uuid := 'a55c0001-5a17-4a17-8a17-c00000000033'::uuid;
  res5 uuid := 'a55c0001-5a17-4a17-8a17-c00000000034'::uuid;
  inv1 uuid := 'a55c0001-5a17-4a17-8a17-c00000000040'::uuid;
  inv2 uuid := 'a55c0001-5a17-4a17-8a17-c00000000041'::uuid;
  inv3 uuid := 'a55c0001-5a17-4a17-8a17-c00000000042'::uuid;
  news1 uuid := 'a55c0001-5a17-4a17-8a17-c00000000050'::uuid;
  news2 uuid := 'a55c0001-5a17-4a17-8a17-c00000000051'::uuid;
  news3 uuid := 'a55c0001-5a17-4a17-8a17-c00000000052'::uuid;
  c1 uuid := 'a55c0001-5a17-4a17-8a17-c00000000060'::uuid;
  c2 uuid := 'a55c0001-5a17-4a17-8a17-c00000000061'::uuid;
  c3 uuid := 'a55c0001-5a17-4a17-8a17-c00000000062'::uuid;
  po1 text := 'sk-po-fisch-01';
  po2 text := 'sk-po-hof-01';
  cat_vorspeisen uuid := 'a55c0001-5a17-4a17-8a17-c00000000080'::uuid;
  cat_haupt uuid := 'a55c0001-5a17-4a17-8a17-c00000000081'::uuid;
  cat_beilagen uuid := 'a55c0001-5a17-4a17-8a17-c00000000082'::uuid;
  cat_desserts uuid := 'a55c0001-5a17-4a17-8a17-c00000000083'::uuid;
  cat_getraenke uuid := 'a55c0001-5a17-4a17-8a17-c00000000084'::uuid;
  item_makrele uuid := 'a55c0001-5a17-4a17-8a17-c00000000090'::uuid;
  item_garnelen uuid := 'a55c0001-5a17-4a17-8a17-c00000000091'::uuid;
  item_matjes uuid := 'a55c0001-5a17-4a17-8a17-c00000000092'::uuid;
  item_suppe uuid := 'a55c0001-5a17-4a17-8a17-c00000000093'::uuid;
  item_scholle uuid := 'a55c0001-5a17-4a17-8a17-c00000000094'::uuid;
  item_rind uuid := 'a55c0001-5a17-4a17-8a17-c00000000095'::uuid;
  item_sellerie uuid := 'a55c0001-5a17-4a17-8a17-c00000000096'::uuid;
  item_bete uuid := 'a55c0001-5a17-4a17-8a17-c00000000097'::uuid;
  item_sanddorn uuid := 'a55c0001-5a17-4a17-8a17-c00000000098'::uuid;
  item_bier uuid := 'a55c0001-5a17-4a17-8a17-c00000000099'::uuid;
  item_aquavit uuid := 'a55c0001-5a17-4a17-8a17-c0000000009a'::uuid;
  item_fries uuid := 'a55c0001-5a17-4a17-8a17-c0000000009b'::uuid;
  wd text;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email) limit 1;

  if v_user_id is null then
    v_user_id := 'a55c0001-5a17-4a17-8a17-c00000000002'::uuid;
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
      '{"given_name":"Messe","family_name":"Demo","full_name":"Messe Demo"}'::jsonb,
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
    phone, email, website, social_handle,
    brand_accent_hex,
    avatar_storage_path, cover_storage_path,
    owner_profile_id, is_published
  ) values (
    v_rid,
    'salzkante',
    'Die Salzkante',
    'Moderne Nordseeküche am Hamburger Fischmarkt: hausgeräucherter Fang, fermentiertes Gemüse und regionale Biere. In einem alten Kontorhaus in Altona treffen Wind, Salz und Holzofen auf zeitgemäße Gastronomie — klar, saisonal, ohne Schnickschnack.',
    v_tz,
    'Große Elbstraße 132', 'Hamburg', '22767', 'DE',
    '+494031278450', v_email, 'https://gwada.app/salzkante', '@diesalzkante',
    '#0B4F6C',
    'a55c0001-5a17-4a17-8a17-c00000000001/avatar.jpg',
    'a55c0001-5a17-4a17-8a17-c00000000001/cover.jpg',
    v_user_id, true
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
    website = excluded.website,
    social_handle = excluded.social_handle,
    brand_accent_hex = excluded.brand_accent_hex,
    avatar_storage_path = excluded.avatar_storage_path,
    cover_storage_path = excluded.cover_storage_path,
    owner_profile_id = excluded.owner_profile_id,
    is_published = excluded.is_published,
    updated_at = timezone('utc', now());

  select id into v_rid from public.restaurants where slug = 'salzkante' limit 1;

  insert into public.profiles (id, display_name, locale, given_name, family_name)
  values (v_user_id, 'Messe Demo', 'de-DE', 'Messe', 'Demo')
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

  -- Kein platform_superadmins — normales Owner-Login für Messestand

  perform public.seed_restaurant_default_positions(v_rid);

  insert into public.restaurant_menu_settings (restaurant_id, currency_code)
  values (v_rid, 'EUR')
  on conflict (restaurant_id) do update set currency_code = 'EUR';

  insert into public.restaurant_reservation_settings (restaurant_id)
  values (v_rid)
  on conflict (restaurant_id) do nothing;

  insert into public.restaurant_contact_settings (restaurant_id)
  values (v_rid)
  on conflict (restaurant_id) do nothing;

  insert into public.restaurant_news_settings (restaurant_id)
  values (v_rid)
  on conflict (restaurant_id) do nothing;

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

  -- Öffnungszeiten (business) — neu setzen
  delete from public.opening_hours
  where restaurant_id = v_rid and kind = 'weekly' and schedule_role = 'business';

  foreach wd in array array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  loop
    insert into public.opening_hours (
      restaurant_id, kind, weekday, closed, opens_at, closes_at, schedule_role
    ) values (
      v_rid, 'weekly', wd,
      (wd = 'monday'),
      case when wd = 'monday' then null else time '12:00' end,
      case when wd = 'monday' then null
           when wd = 'sunday' then time '21:00'
           else time '22:30' end,
      'business'
    );
  end loop;

  -- Speisekarte
  insert into public.menu_categories (id, restaurant_id, name, sort_order, is_active) values
    (cat_vorspeisen, v_rid, 'Vorspeisen vom Meer', 0, true),
    (cat_haupt, v_rid, 'Hauptgerichte', 1, true),
    (cat_beilagen, v_rid, 'Beilagen & Gemüse', 2, true),
    (cat_desserts, v_rid, 'Süßes', 3, true),
    (cat_getraenke, v_rid, 'Getränke', 4, true)
  on conflict (id) do update set
    name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

  insert into public.menu_tags (id, restaurant_id, name, background_color, sort_order, is_active) values
    ('a55c0001-5a17-4a17-8a17-c000000000a1', v_rid, 'Hausräucherung', '#0B4F6C', 0, true),
    ('a55c0001-5a17-4a17-8a17-c000000000a2', v_rid, 'Vegetarisch', '#059669', 1, true),
    ('a55c0001-5a17-4a17-8a17-c000000000a3', v_rid, 'Empfehlung', '#C4A35A', 2, true)
  on conflict (id) do nothing;

  insert into public.menu_allergens (id, restaurant_id, name, background_color, sort_order, is_active) values
    ('a55c0001-5a17-4a17-8a17-c000000000b1', v_rid, 'Fisch', '#0284c7', 0, true),
    ('a55c0001-5a17-4a17-8a17-c000000000b2', v_rid, 'Krebstiere', '#ea580c', 1, true),
    ('a55c0001-5a17-4a17-8a17-c000000000b3', v_rid, 'Milch', '#7c3aed', 2, true),
    ('a55c0001-5a17-4a17-8a17-c000000000b4', v_rid, 'Gluten', '#d97706', 3, true)
  on conflict (id) do nothing;

  -- image_url wird nach Media-Upload gesetzt; Platzhalter-Pfade als https bleiben leer bis Upload-Skript patched
  insert into public.menu_items (
    id, restaurant_id, category_id, name, description, price, image_url, is_active, list_number
  ) values
    (item_makrele, v_rid, cat_vorspeisen,
      'Geräucherte Makrele',
      'Hausgeräuchert über Buchenholz, fermentierte Gurke, Dillöl und Roggen-Crumble.',
      14.50, null, true, 1),
    (item_garnelen, v_rid, cat_vorspeisen,
      'Nordseegarnelen mit Meerrettich',
      'Frische Büsumer Garnelen, Meerrettichschaum, Avocado und knusprige Kartoffelstrohhalme.',
      16.90, null, true, 2),
    (item_matjes, v_rid, cat_vorspeisen,
      'Matjes zwei Wege',
      'Klassisch und gebeizt, mit Apfel, roter Zwiebel, Sauerrahm und Dill.',
      13.50, null, true, 3),
    (item_suppe, v_rid, cat_vorspeisen,
      'Nordseefischsuppe',
      'Safranfond, Miesmuscheln, Weißfisch, Fenchel und Kräuteröl — mit Sauerteig.',
      12.90, null, true, 4),
    (item_scholle, v_rid, cat_haupt,
      'Gebratene Scholle',
      'Butter, Kapern, Queller, neue Kartoffeln und Zitrone — klar norddeutsch.',
      24.50, null, true, 5),
    (item_rind, v_rid, cat_haupt,
      'Holstein-Rind mit Markkruste',
      'Langsam gegart, geräucherte Knochenmark-Kruste, Wurzelgemüse und Bierjus.',
      29.90, null, true, 6),
    (item_sellerie, v_rid, cat_haupt,
      'Sellerie-Steak',
      'Ofengerösteter Knollensellerie, geräucherte Mandelcreme, Wildkräuter und schwarzer Knoblauch.',
      21.50, null, true, 7),
    (item_bete, v_rid, cat_beilagen,
      'Rote-Bete-Salat',
      'Fermentierte Bete, Meerrettichcreme, Haselnuss und Mikrokräuter.',
      8.90, null, true, 8),
    (item_fries, v_rid, cat_beilagen,
      'Salzkartoffeln mit Quellerbutter',
      'Festkochend, braune Butter mit Queller und Meersalzflocken.',
      6.50, null, true, 9),
    (item_sanddorn, v_rid, cat_desserts,
      'Sanddorn-Panna-Cotta',
      'Herb-fruchtig, weiße Schokolade und Minze.',
      9.50, null, true, 10),
    (item_bier, v_rid, cat_getraenke,
      'Küsten-Pale Ale 0,4 l',
      'Hopfiges Hausbier von der norddeutschen Kleinbrauerei — passt zu Räucherfisch.',
      4.90, null, true, 11),
    (item_aquavit, v_rid, cat_getraenke,
      'Aquavit vom Fass 2 cl',
      'Kümmel, Dill und ein Hauch Rauch — unser Digestif.',
      5.50, null, true, 12)
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    category_id = excluded.category_id,
    is_active = true,
    list_number = excluded.list_number;

  insert into public.menu_item_tags (menu_item_id, tag_id) values
    (item_makrele, 'a55c0001-5a17-4a17-8a17-c000000000a1'),
    (item_makrele, 'a55c0001-5a17-4a17-8a17-c000000000a3'),
    (item_garnelen, 'a55c0001-5a17-4a17-8a17-c000000000a3'),
    (item_sellerie, 'a55c0001-5a17-4a17-8a17-c000000000a2'),
    (item_bete, 'a55c0001-5a17-4a17-8a17-c000000000a2'),
    (item_scholle, 'a55c0001-5a17-4a17-8a17-c000000000a3')
  on conflict (menu_item_id, tag_id) do nothing;

  insert into public.menu_item_allergens (menu_item_id, allergen_id) values
    (item_makrele, 'a55c0001-5a17-4a17-8a17-c000000000b1'),
    (item_garnelen, 'a55c0001-5a17-4a17-8a17-c000000000b2'),
    (item_matjes, 'a55c0001-5a17-4a17-8a17-c000000000b1'),
    (item_matjes, 'a55c0001-5a17-4a17-8a17-c000000000b3'),
    (item_suppe, 'a55c0001-5a17-4a17-8a17-c000000000b1'),
    (item_suppe, 'a55c0001-5a17-4a17-8a17-c000000000b2'),
    (item_suppe, 'a55c0001-5a17-4a17-8a17-c000000000b4'),
    (item_scholle, 'a55c0001-5a17-4a17-8a17-c000000000b1'),
    (item_sanddorn, 'a55c0001-5a17-4a17-8a17-c000000000b3')
  on conflict (menu_item_id, allergen_id) do nothing;

  -- Bestand
  insert into public.inventory_suppliers (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'sk-sup-fisch', 'Fischereigenossenschaft Cuxhaven', 0, true),
    (v_rid, 'sk-sup-hof', 'Biohof Vierlande', 1, true),
    (v_rid, 'sk-sup-getraenk', 'Getränkefachmarkt Altona', 2, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_ingredient_categories (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'sk-cat-fish', 'Fisch & Meeresfrüchte', 0, true),
    (v_rid, 'sk-cat-veg', 'Gemüse & Kräuter', 1, true),
    (v_rid, 'sk-cat-dry', 'Trocken & Getränke', 2, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_production_sites (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'sk-ps-rauch', 'Räucherkammer', 0, true),
    (v_rid, 'sk-ps-kueche', 'Warmküche', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_brands (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'sk-br-haus', 'Salzkante Haus', 0, true),
    (v_rid, 'sk-br-region', 'Regional', 1, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_units (restaurant_id, id, name, sort_order, is_active) values
    (v_rid, 'g', 'Gramm (g)', 0, true),
    (v_rid, 'kg', 'Kilogramm (kg)', 1, true),
    (v_rid, 'l', 'Liter (l)', 2, true),
    (v_rid, 'stk', 'Stück', 3, true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.inventory_ingredients (
    restaurant_id, id, name, unit, current_stock,
    supplier_id, category_id, production_site_id, brand_id, is_active
  ) values
    (v_rid, 'sk-ing-makrele', 'Makrele ganz', 'kg', 18, 'sk-sup-fisch', 'sk-cat-fish', 'sk-ps-rauch', 'sk-br-region', true),
    (v_rid, 'sk-ing-garnelen', 'Nordseegarnelen', 'kg', 8, 'sk-sup-fisch', 'sk-cat-fish', 'sk-ps-kueche', 'sk-br-region', true),
    (v_rid, 'sk-ing-scholle', 'Scholle Filet', 'kg', 12, 'sk-sup-fisch', 'sk-cat-fish', 'sk-ps-kueche', 'sk-br-region', true),
    (v_rid, 'sk-ing-dill', 'Dill frisch', 'g', 2400, 'sk-sup-hof', 'sk-cat-veg', 'sk-ps-kueche', 'sk-br-haus', true),
    (v_rid, 'sk-ing-bete', 'Rote Bete', 'kg', 15, 'sk-sup-hof', 'sk-cat-veg', 'sk-ps-kueche', 'sk-br-region', true),
    (v_rid, 'sk-ing-sellerie', 'Knollensellerie', 'stk', 24, 'sk-sup-hof', 'sk-cat-veg', 'sk-ps-kueche', 'sk-br-region', true),
    (v_rid, 'sk-ing-aquavit', 'Aquavit Fass', 'l', 6, 'sk-sup-getraenk', 'sk-cat-dry', 'sk-ps-kueche', 'sk-br-haus', true),
    (v_rid, 'sk-ing-butter', 'Butter', 'kg', 10, 'sk-sup-hof', 'sk-cat-dry', 'sk-ps-kueche', 'sk-br-region', true)
  on conflict (restaurant_id, id) do nothing;

  insert into public.menu_item_recipe_lines (menu_item_id, ingredient_id, amount, sort_order) values
    (item_makrele, 'sk-ing-makrele', 0.180, 0),
    (item_makrele, 'sk-ing-dill', 5, 1),
    (item_garnelen, 'sk-ing-garnelen', 0.120, 0),
    (item_scholle, 'sk-ing-scholle', 0.220, 0),
    (item_scholle, 'sk-ing-butter', 0.040, 1),
    (item_sellerie, 'sk-ing-sellerie', 1, 0),
    (item_bete, 'sk-ing-bete', 0.150, 0)
  on conflict (menu_item_id, ingredient_id) do nothing;

  insert into public.inventory_purchase_orders (
    id, restaurant_id, supplier_id, supplier_name, status, created_at, created_by, delivery_date
  ) values
    (po1, v_rid, 'sk-sup-fisch', 'Fischereigenossenschaft Cuxhaven', 'open',
      timezone('utc', now()) - interval '1 day', 'messe-demo', (timezone(v_tz, now()))::date + 2),
    (po2, v_rid, 'sk-sup-hof', 'Biohof Vierlande', 'ordered',
      timezone('utc', now()) - interval '3 days', 'messe-demo', (timezone(v_tz, now()))::date + 1)
  on conflict (restaurant_id, id) do nothing;

  -- Mitarbeiter mit Rollen für Rechte-Demo
  insert into public.restaurant_staff_position_tags (id, restaurant_id, name, background_color, sort_order, is_active) values
    (tag_kitchen, v_rid, 'Räucherung', '#0B4F6C', 0, true),
    (tag_service, v_rid, 'Service', '#C4A35A', 1, true),
    (tag_host, v_rid, 'Empfang', '#0284c7', 2, true)
  on conflict (id) do nothing;

  select id into pos_owner from public.restaurant_positions
  where restaurant_id = v_rid and slug = 'owner' limit 1;
  select id into pos_kitchen from public.restaurant_positions
  where restaurant_id = v_rid and slug = 'kitchen' limit 1;
  select id into pos_service from public.restaurant_positions
  where restaurant_id = v_rid and slug = 'server' limit 1;
  select id into pos_host from public.restaurant_positions
  where restaurant_id = v_rid and slug = 'host' limit 1;

  insert into public.restaurant_staff (
    id, restaurant_id, profile_id, given_name, family_name,
    email, phone, position_tag_id, restaurant_position_id, is_active
  ) values
    (staff_owner, v_rid, v_user_id, 'Messe', 'Demo', v_email, '+494031278450', tag_host, pos_owner, true),
    (staff_kitchen, v_rid, null, 'Lina', 'Kruse', 'lina.kruse@salzkante.demo', '+491701112233', tag_kitchen, pos_kitchen, true),
    (staff_service, v_rid, null, 'Jonas', 'Behrens', 'jonas.behrens@salzkante.demo', '+491702223344', tag_service, pos_service, true),
    (staff_host, v_rid, null, 'Mara', 'Ostermann', 'mara.ostermann@salzkante.demo', '+491703334455', tag_host, pos_host, true)
  on conflict (id) do update set
    profile_id = excluded.profile_id,
    restaurant_position_id = excluded.restaurant_position_id,
    is_active = true;

  -- Reservierungen über mehrere Tage
  v_local_today := (timezone(v_tz, now()))::date;
  select id into st_pending from public.reservation_statuses where code = 'pending' limit 1;
  select id into st_confirmed from public.reservation_statuses where code = 'confirmed' limit 1;
  select id into st_cancelled from public.reservation_statuses where code = 'cancelled' limit 1;
  select id into st_seated from public.reservation_statuses where code = 'seated' limit 1;
  if st_seated is null then
    st_seated := st_confirmed;
  end if;

  insert into public.restaurant_reservation_counters (restaurant_id, next_number)
  values (v_rid, 20)
  on conflict (restaurant_id) do nothing;

  insert into public.reservations (
    id, restaurant_id, reservation_number,
    guest_first_name, guest_last_name, guest_phone, guest_email,
    party_size, starts_at, ends_at, status_id,
    guest_pin, notify_email, notify_whatsapp, terms_accepted, notes
  ) values
    (res1, v_rid, 1, 'Clara', 'Nielsen', '+4915112345601', 'clara.nielsen@example.com', 2,
      (v_local_today + time '12:30')::timestamp at time zone v_tz,
      (v_local_today + time '14:00')::timestamp at time zone v_tz,
      st_confirmed, '481902', true, false, true, 'Fensterplatz erwünscht'),
    (res2, v_rid, 2, 'Henrik', 'Sander', '+4916012345602', 'henrik.sander@example.com', 4,
      (v_local_today + time '19:00')::timestamp at time zone v_tz,
      (v_local_today + time '21:00')::timestamp at time zone v_tz,
      st_pending, '193847', true, true, true, 'Geburtstag — Kerze'),
    (res3, v_rid, 3, 'Freja', 'Holm', '+4917112345603', 'freja.holm@example.com', 3,
      ((v_local_today + 1) + time '18:30')::timestamp at time zone v_tz,
      ((v_local_today + 1) + time '20:30')::timestamp at time zone v_tz,
      st_confirmed, '550012', true, false, true, null),
    (res4, v_rid, 4, 'Otto', 'Brandt', '+4915212345604', 'otto.brandt@example.com', 6,
      ((v_local_today + 2) + time '20:00')::timestamp at time zone v_tz,
      ((v_local_today + 2) + time '22:30')::timestamp at time zone v_tz,
      st_confirmed, '660078', true, true, true, 'Geschäftsessen'),
    (res5, v_rid, 5, 'Silke', 'Moeller', '+4917012345605', 'silke.moeller@example.com', 2,
      ((v_local_today - 2) + time '13:00')::timestamp at time zone v_tz,
      ((v_local_today - 2) + time '14:30')::timestamp at time zone v_tz,
      st_cancelled, '770043', false, false, true, 'storniert')
  on conflict (id) do nothing;

  -- Bewertungen
  insert into public.gwada_review_invitations (id, restaurant_id, reservation_id, token, expires_at, completed_at)
  values
    (inv1, v_rid, res1, 'salzkante-review-0001', timezone('utc', now()) + interval '30 days', timezone('utc', now()) - interval '1 day'),
    (inv2, v_rid, res3, 'salzkante-review-0002', timezone('utc', now()) + interval '30 days', timezone('utc', now()) - interval '3 days'),
    (inv3, v_rid, res4, 'salzkante-review-0003', timezone('utc', now()) + interval '30 days', null)
  on conflict (id) do nothing;

  insert into public.gwada_reviews (id, restaurant_id, reservation_id, invitation_id, rating, comment, guest_display_name, created_at)
  values
    ('a55c0001-5a17-4a17-8a17-c000000000c1', v_rid, res1, inv1, 5,
      'Die geräucherte Makrele ist der Hammer — so frisch und klar in Altona.',
      'Clara Nielsen', timezone('utc', now()) - interval '1 day'),
    ('a55c0001-5a17-4a17-8a17-c000000000c2', v_rid, res3, inv2, 4,
      'Scholle top, Service freundlich. Etwas laut am Abend, aber Atmosphäre stimmt.',
      'Freja Holm', timezone('utc', now()) - interval '3 days')
  on conflict (id) do nothing;

  -- Kontakte
  insert into public.contacts (
    id, restaurant_id, first_name, last_name, company, notes, guest_pin, last_interaction_at
  ) values
    (c1, v_rid, 'Clara', 'Nielsen', null, 'Stammgast Mittag', '101001', timezone('utc', now()) - interval '1 day'),
    (c2, v_rid, 'Henrik', 'Sander', 'Nordhafen GmbH', 'Geschäftsessen', '101002', timezone('utc', now()) - interval '2 hours'),
    (c3, v_rid, 'Freja', 'Holm', null, 'Allergie: Schalenfrüchte', '101003', timezone('utc', now()) - interval '3 days')
  on conflict (id) do nothing;

  insert into public.contact_emails (contact_id, restaurant_id, email, email_normalized, is_primary, sort_order)
  values
    (c1, v_rid, 'clara.nielsen@example.com', 'clara.nielsen@example.com', true, 0),
    (c2, v_rid, 'henrik.sander@example.com', 'henrik.sander@example.com', true, 0),
    (c3, v_rid, 'freja.holm@example.com', 'freja.holm@example.com', true, 0)
  on conflict do nothing;

  insert into public.contact_phones (contact_id, restaurant_id, phone_display, phone_normalized, country_iso2, is_primary, sort_order)
  values
    (c1, v_rid, '+49 151 12345601', '+4915112345601', 'DE', true, 0),
    (c2, v_rid, '+49 160 12345602', '+4916012345602', 'DE', true, 0),
    (c3, v_rid, '+49 171 12345603', '+4917112345603', 'DE', true, 0)
  on conflict do nothing;

  -- News (Medienpfade werden vom Upload-Skript befüllt)
  insert into public.gwada_news_posts (
    id, restaurant_id, title, body, status, published_at, media, created_by, updated_by
  ) values
    (news1, v_rid,
      'Neue Räucherkammer in Betrieb',
      'Ab sofort räuchern wir Makrele und Speck wieder im Haus — über Buchenholz, 14 Stunden. Kommt vorbei und riecht den Unterschied.',
      'published', timezone('utc', now()) - interval '2 days',
      '[{"id":"a55c-news-media-1","kind":"image","storagePath":"a55c0001-5a17-4a17-8a17-c00000000001/news/raucherkammer.jpg","mimeType":"image/jpeg","sortOrder":0}]'::jsonb,
      v_user_id, v_user_id),
    (news2, v_rid,
      'Sonntags-Mittagstisch',
      'Jeden Sonntag von 12 bis 15 Uhr: Nordseefischsuppe, Scholle und Sanddorn-Dessert zum Festpreis. Reservierung empfohlen.',
      'published', timezone('utc', now()) - interval '5 days',
      '[{"id":"a55c-news-media-2","kind":"image","storagePath":"a55c0001-5a17-4a17-8a17-c00000000001/news/sonntag.jpg","mimeType":"image/jpeg","sortOrder":0}]'::jsonb,
      v_user_id, v_user_id),
    (news3, v_rid,
      'Bier & Aquavit Pairing',
      'Freitags ab 18 Uhr: unser Küsten-Pale Ale und Fass-Aquavit zu Räucherplatten. Begrenzte Plätze an der Bar.',
      'published', timezone('utc', now()) - interval '8 days',
      '[{"id":"a55c-news-media-3","kind":"image","storagePath":"a55c0001-5a17-4a17-8a17-c00000000001/news/pairing.jpg","mimeType":"image/jpeg","sortOrder":0}]'::jsonb,
      v_user_id, v_user_id)
  on conflict (id) do update set
    title = excluded.title,
    body = excluded.body,
    status = 'published',
    media = excluded.media,
    published_at = excluded.published_at;

  insert into public.gwada_news_publications (
    id, post_id, restaurant_id, platform, status, published_at, external_url
  ) values
    ('a55c0001-5a17-4a17-8a17-c000000000d1', news1, v_rid, 'gwada', 'published', timezone('utc', now()) - interval '2 days', null),
    ('a55c0001-5a17-4a17-8a17-c000000000d2', news2, v_rid, 'gwada', 'published', timezone('utc', now()) - interval '5 days', null),
    ('a55c0001-5a17-4a17-8a17-c000000000d3', news3, v_rid, 'gwada', 'published', timezone('utc', now()) - interval '8 days', null)
  on conflict (id) do nothing;

  -- Social / Integrationen: UI „verbunden“, ohne echte Tokens (Demo-Platzhalter)
  insert into public.restaurant_integrations (
    restaurant_id, integration_key, waha_session_name, status,
    display_name, connected_at, last_error, config
  ) values
    (v_rid, 'facebook', 'facebook', 'working',
      'Die Salzkante', timezone('utc', now()) - interval '10 days', null,
      '{"demo_placeholder":true,"page_id":"demo-salzkante-fb","page_name":"Die Salzkante","page_access_token":"","user_access_token":""}'::jsonb),
    (v_rid, 'instagram', 'instagram', 'working',
      '@diesalzkante', timezone('utc', now()) - interval '10 days', null,
      '{"demo_placeholder":true,"page_id":"demo-salzkante-fb","page_name":"Die Salzkante","instagram_business_account_id":"demo-ig-salzkante","page_access_token":"","user_access_token":""}'::jsonb),
    (v_rid, 'google_business', 'google_business', 'working',
      'Die Salzkante · Hamburg', timezone('utc', now()) - interval '10 days', null,
      '{"demo_placeholder":true,"account_name":"demo-accounts/salzkante","location_name":"demo-locations/salzkante","access_token":"","refresh_token":""}'::jsonb),
    (v_rid, 'tripadvisor', 'tripadvisor', 'working',
      'Die Salzkante', timezone('utc', now()) - interval '7 days', null,
      '{"demo_placeholder":true,"location_id":"demo-ta-salzkante"}'::jsonb)
  on conflict (restaurant_id, integration_key) do update set
    status = excluded.status,
    display_name = excluded.display_name,
    connected_at = excluded.connected_at,
    last_error = null,
    config = excluded.config,
    updated_at = timezone('utc', now());

  -- WhatsApp bewusst nicht als working (keine WAHA-Session) — UI zeigt getrennt
  insert into public.restaurant_integrations (
    restaurant_id, integration_key, waha_session_name, status,
    display_name, connected_at, last_error, config
  ) values (
    v_rid, 'whatsapp', 'messe-salzkante-demo', 'disconnected',
    null, null, null,
    '{"demo_placeholder":true,"note":"Messedemo — kein echtes WAHA"}'::jsonb
  )
  on conflict (restaurant_id, integration_key) do update set
    status = 'disconnected',
    config = excluded.config,
    updated_at = timezone('utc', now());

  -- Assistant: kein Key anlegen — David trägt eigenen Key ein

  raise notice 'provision-messe-salzkante: OK user=% restaurant=% email=% slug=salzkante',
    v_user_id, v_rid, v_email;
end $$;
