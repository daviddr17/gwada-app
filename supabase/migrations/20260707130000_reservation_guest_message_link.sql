-- Gast-Nachrichten an Reservierung: Lesen für Reservierungs-Team + Bestands-Verknüpfung.

create policy "contact_messages_reservations_staff_select"
  on public.contact_messages for select
  to authenticated
  using (
    reservation_id is not null
    and public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
  );

comment on policy "contact_messages_reservations_staff_select" on public.contact_messages is
  'Reservierungs-Modul: Nachrichten mit reservation_id lesen (ohne contacts.manage).';

-- Bestand: eingehende Gwada-Nachrichten ohne reservation_id an passende Gast-Reservierung hängen.
update public.contact_messages cm
set reservation_id = r.id
from public.reservations r
where cm.reservation_id is null
  and cm.restaurant_id = r.restaurant_id
  and cm.contact_id = r.contact_id
  and cm.direction = 'inbound'
  and cm.platform = 'gwada'
  and r.created_by_profile_id is null
  and cm.created_at >= r.created_at - interval '2 minutes'
  and cm.created_at <= r.created_at + interval '15 minutes'
  and not exists (
    select 1
    from public.contact_messages cm2
    where cm2.reservation_id = r.id
      and cm2.direction = 'inbound'
      and cm2.platform = 'gwada'
      and cm2.id <> cm.id
  );
