-- Optionale Anzeige von/bis für Tages- und Wochengerichte (Speisekarte).
alter table public.menu_items
  add column if not exists available_from date,
  add column if not exists available_to date;

alter table public.menu_items
  drop constraint if exists menu_items_availability_range_check;

alter table public.menu_items
  add constraint menu_items_availability_range_check
  check (
    available_to is null
    or available_from is null
    or available_to >= available_from
  );

comment on column public.menu_items.available_from is
  'Optional: erstes Anzeigedatum (lokal, inklusive). NULL = kein Startlimit.';

comment on column public.menu_items.available_to is
  'Optional: letztes Anzeigedatum (lokal, inklusive). NULL = kein Endlimit.';
