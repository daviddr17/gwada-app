-- Gast-Nachricht bei neuer Reservierung: in reservations_pending-Payload mergen (ein Push statt zwei).

create or replace function public.trg_merge_reservation_guest_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview text;
begin
  if new.direction <> 'inbound'
    or not coalesce(new.suppress_notifications, false)
    or new.reservation_id is null then
    return new;
  end if;

  preview := left(trim(coalesce(new.body, '')), 200);
  if preview = '' then
    return new;
  end if;

  update public.notification_events e
  set payload = e.payload || jsonb_build_object('messagePreview', preview)
  where e.module = 'reservations_pending'
    and e.reference_id = new.reservation_id::text
    and e.restaurant_id = new.restaurant_id
    and not (e.payload ? 'messagePreview');

  return new;
end;
$$;

drop trigger if exists contact_messages_merge_reservation_guest_notification
  on public.contact_messages;

create trigger contact_messages_merge_reservation_guest_notification
  after insert on public.contact_messages
  for each row
  execute function public.trg_merge_reservation_guest_message_notification();

comment on function public.trg_merge_reservation_guest_message_notification() is
  'Inbound-Gastnachricht mit suppress_notifications: Vorschau in reservations_pending-Event (kein zweites Push).';
