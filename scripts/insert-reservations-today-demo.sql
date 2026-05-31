-- Fünf Test-Reservierungen für heute (lokale Kalenderzeit Europe/Berlin).
-- Verwendet das erste Restaurant in der DB (bei dir: zurschlagd).
--
-- Anwenden: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/insert-reservations-today-demo.sql

do $$
declare
  v_rid uuid;
  v_day date := current_date;
  st_pending uuid;
  st_confirmed uuid;
  st_seated uuid;
  tbl uuid;
begin
  select id into v_rid from public.restaurants order by created_at limit 1;
  if v_rid is null then
    raise exception 'Kein Restaurant in der DB.';
  end if;

  select id into st_pending from public.reservation_statuses where code = 'pending' limit 1;
  select id into st_confirmed from public.reservation_statuses where code = 'confirmed' limit 1;
  select id into st_seated from public.reservation_statuses where code = 'seated' limit 1;

  select id into tbl
  from public.dining_tables
  where restaurant_id = v_rid and is_active
  order by table_number
  limit 1;

  delete from public.reservations
  where restaurant_id = v_rid
    and guest_email like '%@example.com'
    and guest_last_name in ('Fischer', 'Bauer', 'Richter', 'Klein', 'Wolf');

  insert into public.reservations (
    restaurant_id,
    guest_first_name,
    guest_last_name,
    guest_email,
    guest_phone,
    party_size,
    starts_at,
    ends_at,
    status_id,
    dining_table_id,
    notify_email,
    notify_whatsapp,
    terms_accepted
  )
  values
    (
      v_rid, 'Laura', 'Fischer', 'laura.fischer@example.com', '+491701010101', 2,
      (v_day + time '12:00') at time zone 'Europe/Berlin',
      (v_day + time '14:00') at time zone 'Europe/Berlin',
      st_pending, null, false, false, true
    ),
    (
      v_rid, 'Markus', 'Bauer', 'markus.bauer@example.com', '+491702020202', 4,
      (v_day + time '12:30') at time zone 'Europe/Berlin',
      (v_day + time '15:00') at time zone 'Europe/Berlin',
      st_confirmed, tbl, true, false, true
    ),
    (
      v_rid, 'Sofia', 'Richter', 'sofia.richter@example.com', '+491703030303', 2,
      (v_day + time '18:00') at time zone 'Europe/Berlin',
      (v_day + time '20:00') at time zone 'Europe/Berlin',
      st_confirmed, tbl, true, true, true
    ),
    (
      v_rid, 'Jonas', 'Klein', 'jonas.klein@example.com', '+491704040404', 3,
      (v_day + time '19:00') at time zone 'Europe/Berlin',
      (v_day + time '21:30') at time zone 'Europe/Berlin',
      st_pending, null, false, false, true
    ),
    (
      v_rid, 'Elena', 'Wolf', 'elena.wolf@example.com', '+491705050505', 2,
      (v_day + time '20:00') at time zone 'Europe/Berlin',
      (v_day + time '22:00') at time zone 'Europe/Berlin',
      st_seated, tbl, false, false, true
    );
end $$;
