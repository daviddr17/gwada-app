-- Große Gruppen (Events) über Dashboard/Staff: party_size bis 200.
-- Öffentliches Embed bleibt app-seitig bei 30.

alter table public.reservations
  drop constraint if exists reservations_party_size_check;

alter table public.reservations
  add constraint reservations_party_size_check
  check (party_size > 0 and party_size <= 200);
