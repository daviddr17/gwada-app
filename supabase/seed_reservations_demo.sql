-- Demo-Reservierungen für Restaurant slug gwada-demo (lokal nach seed.sql + seed_demo_user.sql).
-- Löscht alle bestehenden Reservierungen dieses Restaurants und legt Beispieldaten an.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_rid uuid;
  v_tz text;
  v_local_today date;
  st_pending uuid;
  st_confirmed uuid;
  st_cancelled uuid;
  st_declined uuid;
  v_pin text := extensions.crypt('4829', extensions.gen_salt('bf'));
begin
  select id, coalesce(nullif(trim(timezone), ''), 'UTC')
    into v_rid, v_tz
  from public.restaurants
  where slug = 'gwada-demo'
  limit 1;

  if v_rid is null then
    raise notice 'seed_reservations_demo: no gwada-demo restaurant, skip';
    return;
  end if;

  v_local_today := (timezone(v_tz, now()))::date;

  select id into st_pending from public.reservation_statuses where code = 'pending' limit 1;
  select id into st_confirmed from public.reservation_statuses where code = 'confirmed' limit 1;
  select id into st_cancelled from public.reservation_statuses where code = 'cancelled' limit 1;
  select id into st_declined from public.reservation_statuses where code = 'declined' limit 1;

  delete from public.reservations where restaurant_id = v_rid;

  insert into public.restaurant_reservation_counters (restaurant_id, next_number)
  values (v_rid, 0)
  on conflict (restaurant_id) do update set next_number = 0;

  insert into public.reservations (
    restaurant_id,
    reservation_number,
    guest_first_name,
    guest_last_name,
    guest_phone,
    guest_email,
    party_size,
    starts_at,
    ends_at,
    status_id,
    guest_pin_hash,
    notify_email,
    notify_whatsapp,
    terms_accepted,
    notes
  )
  values
    (
      v_rid,
      1,
      'Marie',
      'Dubois',
      '+590690123456',
      'marie.dubois@example.com',
      2,
      (v_local_today + time '12:30')::timestamp at time zone v_tz,
      (v_local_today + time '14:30')::timestamp at time zone v_tz,
      st_pending,
      v_pin,
      true,
      false,
      true,
      'seed:demo'
    ),
    (
      v_rid,
      2,
      'Jean',
      'Lefevre',
      '+590690222333',
      'jean.lefevre@example.com',
      4,
      (v_local_today + time '19:00')::timestamp at time zone v_tz,
      (v_local_today + time '21:30')::timestamp at time zone v_tz,
      st_confirmed,
      v_pin,
      true,
      true,
      true,
      'seed:demo'
    ),
    (
      v_rid,
      3,
      'Sophie',
      'Martin',
      '+33612345678',
      'sophie.martin@example.com',
      3,
      ((v_local_today + 1) + time '13:00')::timestamp at time zone v_tz,
      ((v_local_today + 1) + time '15:00')::timestamp at time zone v_tz,
      st_cancelled,
      null,
      true,
      false,
      true,
      'seed:demo'
    ),
    (
      v_rid,
      4,
      'Luc',
      'Bernard',
      '+590690999888',
      'luc.bernard@example.com',
      2,
      ((v_local_today + 2) + time '20:00')::timestamp at time zone v_tz,
      ((v_local_today + 2) + time '22:00')::timestamp at time zone v_tz,
      st_declined,
      v_pin,
      false,
      false,
      true,
      'seed:demo'
    );

  insert into public.restaurant_reservation_counters (restaurant_id, next_number)
  values (v_rid, 4)
  on conflict (restaurant_id) do update set next_number = excluded.next_number;
end $$;
