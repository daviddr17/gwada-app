-- Pro-User-Darstellung (Kompakt / Normal / Groß) für Dashboard-Lesbarkeit.

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

update public.profiles
set ui_density = 'normal'
where ui_density is null;
