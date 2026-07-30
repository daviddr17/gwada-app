-- Alter Slot nach akzeptierter Termin-Verschiebung (Änderungsanfrage) sichtbar halten.
-- Kein neuerlicher Status „moved“ im Katalog — nur Spalten für UI-Platzhalter.

alter table public.reservations
  add column if not exists relocated_from_starts_at timestamptz;

alter table public.reservations
  add column if not exists relocated_from_ends_at timestamptz;

alter table public.reservations
  add column if not exists relocated_from_dining_table_id uuid
    references public.dining_tables (id) on delete set null;

comment on column public.reservations.relocated_from_starts_at is
  'Vorheriger Termin-Start nach akzeptierter Verschiebung; für „Verschoben“-Platzhalter in der Tagesansicht.';

comment on column public.reservations.relocated_from_ends_at is
  'Vorheriges Termin-Ende nach akzeptierter Verschiebung.';

comment on column public.reservations.relocated_from_dining_table_id is
  'Tisch am alten Slot (nur Anzeige am Platzhalter).';

create index if not exists reservations_relocated_from_starts_at_idx
  on public.reservations (restaurant_id, relocated_from_starts_at)
  where relocated_from_starts_at is not null;
