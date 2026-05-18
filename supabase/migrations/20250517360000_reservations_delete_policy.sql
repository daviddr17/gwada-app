-- Staff und Gast dürfen eigene Reservierung löschen (analog zu UPDATE-USING).
create policy "reservations_delete_staff_or_guest"
  on public.reservations for delete
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_is_restaurant_staff(restaurant_id)
  );
