-- SAFE LIVE MIGRATION (schema only)
-- Additive only: neue nullable Spalte auf profiles.
-- - Kein UPDATE bestehender Zeilen
-- - Kein DELETE / Truncate / Reset / Seed
-- - Default gilt nur für NEUE Inserts (PG schreibt bestehende Rows nicht um)
-- - CHECK erlaubt NULL (= App behandelt als "normal")
-- Bestehende Live-Daten (Reservierungen, Gäste, …) bleiben unberührt.

alter table public.profiles
  add column if not exists ui_density text;

alter table public.profiles
  drop constraint if exists profiles_ui_density_check;

alter table public.profiles
  add constraint profiles_ui_density_check
  check (
    ui_density is null
    or ui_density in ('compact', 'normal', 'comfortable')
  );

comment on column public.profiles.ui_density is
  'Dashboard-Darstellung pro Konto: compact | normal | comfortable (null = normal).';

alter table public.profiles
  alter column ui_density set default 'normal';
