-- Drei Reservierungen: 20.05.2026 12:00 offen, 20.05.2026 13:00 bestätigt, 21.05.2026 18:00 storniert.
-- Wandzeit Europe/Berlin. Restaurant slug `gwada-demo`; Migration `reservation_statuses` muss auf der DB liegen.
--
-- **Remote:** `npm run db:seed:reservations-demo` (nach `supabase login` + `supabase link`).
-- **Lokal (App zeigt lokale Supabase):** `npm run db:seed:reservations-demo:local`

do $$
declare
  v_rid uuid;
  st_open uuid;
  st_conf uuid;
  st_can uuid;
begin
  select id into v_rid
  from public.restaurants
  where slug = 'gwada-demo'
  limit 1;

  if v_rid is null then
    raise exception 'Kein Restaurant mit slug gwada-demo — bitte seed.sql ausführen oder slug anpassen.';
  end if;

  select id into st_open from public.reservation_statuses where code = 'pending' limit 1;
  select id into st_conf from public.reservation_statuses where code = 'confirmed' limit 1;
  select id into st_can from public.reservation_statuses where code = 'cancelled' limit 1;

  delete from public.reservations
  where restaurant_id = v_rid
    and notes in (
      'manuell: 20.05.2026 12:00 offen',
      'manuell: 20.05.2026 13:00 bestätigt',
      'manuell: 21.05.2026 18:00 storniert'
    );

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
    terms_accepted,
    notes
  )
  values
    (
      v_rid,
      'Anna',
      'Schmidt',
      'anna.schmidt@example.com',
      '+491701111111',
      2,
      (timestamp '2026-05-20 12:00:00' at time zone 'Europe/Berlin'),
      (timestamp '2026-05-20 14:00:00' at time zone 'Europe/Berlin'),
      st_open,
      true,
      false,
      true,
      'manuell: 20.05.2026 12:00 offen'
    ),
    (
      v_rid,
      'Ben',
      'Müller',
      'ben.mueller@example.com',
      '+491702222222',
      2,
      (timestamp '2026-05-20 13:00:00' at time zone 'Europe/Berlin'),
      (timestamp '2026-05-20 15:30:00' at time zone 'Europe/Berlin'),
      st_conf,
      true,
      true,
      true,
      'manuell: 20.05.2026 13:00 bestätigt'
    ),
    (
      v_rid,
      'Clara',
      'Weber',
      'clara.weber@example.com',
      '+491703333333',
      4,
      (timestamp '2026-05-21 18:00:00' at time zone 'Europe/Berlin'),
      (timestamp '2026-05-21 21:00:00' at time zone 'Europe/Berlin'),
      st_can,
      false,
      false,
      true,
      'manuell: 21.05.2026 18:00 storniert'
    );
end $$;
