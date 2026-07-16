-- Altbestand: Display-Anlagen im Protokoll als Mitarbeiter-Kanal markieren
-- (nicht „Gast“). Personennamen lassen sich historisch nicht zuverlässig rekonstruieren.

update public.restaurant_reservation_log_entries e
set details = jsonb_set(
  coalesce(e.details, '{}'::jsonb),
  '{actorSource}',
  '"display"'
)
where (
  e.details->>'summary' ilike '%über Display%'
  or e.details->>'summary' ilike '%ueber Display%'
  or e.details->>'summary' ilike '%Walk-in (Laufkunde) über Display%'
)
and coalesce(e.details->>'actorSource', '') is distinct from 'display';
