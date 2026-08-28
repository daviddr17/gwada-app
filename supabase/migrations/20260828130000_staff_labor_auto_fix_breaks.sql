alter table public.restaurant_staff_module_settings
  add column if not exists labor_auto_fix_missing_breaks boolean not null default false;

comment on column public.restaurant_staff_module_settings.labor_auto_fix_missing_breaks is
  'Nach Abschluss eines Arbeitseintrags fehlende Mindestpause automatisch verbuchen (ArbZG, DE).';
