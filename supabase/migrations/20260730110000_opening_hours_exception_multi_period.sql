-- Sonderzeiten: mehrere offene Perioden pro Datum (Google Special Hours).
-- Mittagspause / „14:30–17:30 geschlossen“ = zwei open-Zeilen mit Lücke.
-- Ganztägig geschlossen bleibt eine closed-Zeile.

drop index if exists public.opening_hours_exception_one_per_date;

-- Höchstens eine ganztägige Schließung pro Datum.
create unique index opening_hours_exception_closed_one_per_date
  on public.opening_hours (restaurant_id, exception_date)
  where kind = 'exception' and closed = true and schedule_role = 'business';

-- Offene Perioden: gleiche Startzeit am selben Tag nicht doppelt.
create unique index opening_hours_exception_open_period_unique
  on public.opening_hours (restaurant_id, exception_date, opens_at)
  where kind = 'exception' and closed = false and schedule_role = 'business';

comment on table public.opening_hours is
  'Weekly default hours and date exceptions. Exceptions may have multiple open rows per date (split schedule / mid-day break); Google maps each row to a specialHourPeriod.';
