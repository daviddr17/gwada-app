-- Bereiche: Anzeige-Nummer und Chip-Farbe (wie Kategorien/Taxonomie in der Speisekarte).

alter table public.dining_areas
  add column if not exists display_number integer,
  add column if not exists color_hex text;

update public.dining_areas a
set display_number = sq.rn
from (
  select
    id,
    row_number() over (
      partition by restaurant_id
      order by sort_order asc, created_at asc, id asc
    ) as rn
  from public.dining_areas
) sq
where a.id = sq.id
  and a.display_number is null;

update public.dining_areas
set color_hex = '#64748b'
where color_hex is null;

alter table public.dining_areas
  alter column display_number set not null,
  alter column color_hex set not null;

alter table public.dining_areas
  alter column color_hex set default '#64748b';

alter table public.dining_areas
  drop constraint if exists dining_areas_color_hex_format_chk;

alter table public.dining_areas
  add constraint dining_areas_color_hex_format_chk
  check (color_hex ~ '^#[0-9A-Fa-f]{6}$');

create unique index if not exists dining_areas_restaurant_display_number_uidx
  on public.dining_areas (restaurant_id, display_number);

comment on column public.dining_areas.display_number is
  'Anzeige-/Sortiernummer pro Restaurant (eindeutig).';
comment on column public.dining_areas.color_hex is
  'Chip-Farbe (#rrggbb) für Bereichs-Kennzeichnung im Tischplan.';
