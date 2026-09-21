-- ISO2-Ländercode für zentrales Länderprofil (Dropdown in Stammdaten).
alter table public.restaurants
  add column if not exists country_iso2 char(2);

comment on column public.restaurants.country_iso2 is
  'ISO-3166-1 alpha-2 (countries.iso2). Steuert Länderprofil: Zeitzone, Buchhaltung, Vorlagen.';

-- Bestehende Freitext-Länder → ISO2 (Deutschland als Fallback).
update public.restaurants r
set country_iso2 = coalesce(
  (
    select c.iso2
    from public.countries c
    where lower(trim(r.country)) in (lower(c.iso2), lower(c.name_de))
    limit 1
  ),
  case
    when lower(trim(coalesce(r.country, ''))) in ('deutschland', 'germany', 'de') then 'DE'
    when lower(trim(coalesce(r.country, ''))) in ('österreich', 'osterreich', 'austria', 'at') then 'AT'
    when lower(trim(coalesce(r.country, ''))) in ('schweiz', 'switzerland', 'ch') then 'CH'
    when lower(trim(coalesce(r.country, ''))) in ('frankreich', 'france', 'fr') then 'FR'
    else 'DE'
  end
)
where r.country_iso2 is null;

alter table public.restaurants
  alter column country_iso2 set default 'DE';

update public.restaurants
set country_iso2 = 'DE'
where country_iso2 is null;

alter table public.restaurants
  alter column country_iso2 set not null;

create index if not exists restaurants_country_iso2_idx
  on public.restaurants (country_iso2);
