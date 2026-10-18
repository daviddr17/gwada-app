-- Saison-/Dauer-Schließung als Status über dem Wochenplan.
-- opening_hours (Wochentage, Uhrzeiten) bleiben unverändert, damit
-- ein Wiederöffnen den Plan nicht neu aufbauen muss.

alter table public.restaurant_opening_hours_settings
  add column if not exists closure_mode text not null default 'open',
  add column if not exists closure_from date,
  add column if not exists closure_until date;

alter table public.restaurant_opening_hours_settings
  drop constraint if exists restaurant_opening_hours_settings_closure_mode_check;

alter table public.restaurant_opening_hours_settings
  add constraint restaurant_opening_hours_settings_closure_mode_check
  check (closure_mode in ('open', 'temporary', 'permanent'));

alter table public.restaurant_opening_hours_settings
  drop constraint if exists restaurant_opening_hours_settings_closure_range_check;

alter table public.restaurant_opening_hours_settings
  add constraint restaurant_opening_hours_settings_closure_range_check
  check (
    closure_from is null
    or closure_until is null
    or closure_from <= closure_until
  );

comment on column public.restaurant_opening_hours_settings.closure_mode is
  'Status-Overlay: open | temporary (Saison/vorübergehend) | permanent. Wochenplan in opening_hours bleibt.';
comment on column public.restaurant_opening_hours_settings.closure_from is
  'Inklusiver Beginn einer vorübergehenden Schließung (Kalenderdatum, Europe/Berlin).';
comment on column public.restaurant_opening_hours_settings.closure_until is
  'Inklusives Ende einer vorübergehenden Schließung (Kalenderdatum, Europe/Berlin).';
