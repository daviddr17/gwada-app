-- Tagesnotizen: Ersteller bleibt; fremde Einträge mit Reservierungen Bearbeiten/Löschen.

create policy restaurant_reservation_day_note_privilege_update
  on public.restaurant_reservation_day_note_entries for update
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.update')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.update')
  );

create policy restaurant_reservation_day_note_privilege_delete
  on public.restaurant_reservation_day_note_entries for delete
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.delete')
  );

comment on table public.restaurant_reservation_day_note_entries is
  'Protokollartige Tagesnotizen im Reservierungs-Dashboard — Bearbeiten/Löschen durch Autor oder Reservierungen Bearbeiten/Löschen.';
