-- Öffentliches Einbettungs-Widget: Gast-PIN-Verifikation für anon (nur UUID bei Erfolg).

revoke all on function public.verify_reservation_guest_pin(uuid, integer, text) from public;
grant execute on function public.verify_reservation_guest_pin(uuid, integer, text) to anon;
grant execute on function public.verify_reservation_guest_pin(uuid, integer, text) to authenticated;
