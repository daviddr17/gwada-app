-- Eine Test-Reservierung (INSERT) für Live-Notification lokal.
-- psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/insert-reservation-notification-test.sql

do $$
declare
  v_rid uuid;
  st_pending uuid;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  select id into v_rid from public.restaurants order by created_at limit 1;
  if v_rid is null then
    raise exception 'Kein Restaurant in der DB.';
  end if;

  select id into st_pending from public.reservation_statuses where code = 'pending' limit 1;

  v_starts := (current_date + time '19:30') at time zone 'Europe/Berlin';
  v_ends := (current_date + time '21:30') at time zone 'Europe/Berlin';
  if v_starts < timezone('utc', now()) then
    v_starts := timezone('utc', now()) + interval '15 minutes';
    v_ends := v_starts + interval '2 hours';
  end if;

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
    notify_email,
    notify_whatsapp,
    terms_accepted
  )
  values (
    v_rid,
    'Gwada',
    'Notification-Test',
    'gwada-notification-test@example.com',
    '+491709999001',
    2,
    v_starts,
    v_ends,
    st_pending,
    false,
    false,
    true
  );

  raise notice 'Test-Reservierung für Restaurant % angelegt (starts_at %).', v_rid, v_starts;
end $$;
