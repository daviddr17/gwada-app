-- Realtime postgres_changes: volle Zeilen in WAL (Filter + RLS).
alter table public.reservations replica identity full;
alter table public.contact_messages replica identity full;
