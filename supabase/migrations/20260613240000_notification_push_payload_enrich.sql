-- Push-Payloads: mehr Kontext für WhatsApp/E-Mail (Reservierung Kontakt & Notiz).

create or replace function public.trg_emit_notification_event_reservation_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_code text;
begin
  select rs.code into status_code
  from public.reservation_statuses rs
  where rs.id = new.status_id;

  if status_code is distinct from 'pending' then
    return new;
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'reservations_pending',
    new.id::text,
    jsonb_build_object(
      'guestLabel', trim(concat_ws(' ', new.guest_first_name, new.guest_last_name)),
      'partySize', new.party_size,
      'startsAt', new.starts_at,
      'reservationNumber', new.reservation_number,
      'createdByProfileId', new.created_by_profile_id,
      'guestPhone', nullif(trim(coalesce(new.guest_phone, '')), ''),
      'guestEmail', nullif(trim(coalesce(new.guest_email, '')), ''),
      'notesPreview', left(trim(coalesce(new.notes, '')), 200)
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'reservations_pending'
      and e.reference_id = new.id::text
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

create or replace function public.trg_emit_notification_event_reservation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_code text;
  new_code text;
  event_module text;
  guest_label text;
begin
  if new.status_id is not distinct from old.status_id then
    return new;
  end if;

  select rs.code into old_code
  from public.reservation_statuses rs
  where rs.id = old.status_id;

  select rs.code into new_code
  from public.reservation_statuses rs
  where rs.id = new.status_id;

  if new_code = 'change_requested' and old_code is distinct from 'change_requested' then
    event_module := 'reservations_change_request';
  elsif new_code = 'cancelled' and old_code is distinct from 'cancelled' then
    event_module := 'reservations_cancellation';
  else
    return new;
  end if;

  guest_label := trim(concat_ws(' ', new.guest_first_name, new.guest_last_name));

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    event_module,
    new.id::text || ':' || event_module,
    jsonb_build_object(
      'guestLabel', guest_label,
      'partySize', new.party_size,
      'startsAt', new.starts_at,
      'reservationNumber', new.reservation_number,
      'reservationId', new.id,
      'actorProfileId', auth.uid(),
      'guestPhone', nullif(trim(coalesce(new.guest_phone, '')), ''),
      'guestEmail', nullif(trim(coalesce(new.guest_email, '')), ''),
      'notesPreview', left(trim(coalesce(new.notes, '')), 200)
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = event_module
      and e.reference_id = new.id::text || ':' || event_module
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;
