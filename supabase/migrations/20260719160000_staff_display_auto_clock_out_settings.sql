-- Mitarbeiter: automatische Display-Abmeldung nach N Stunden (deaktivierbar)

alter table public.restaurant_staff_module_settings
  add column if not exists display_auto_clock_out_enabled boolean not null default true;

alter table public.restaurant_staff_module_settings
  add column if not exists display_auto_clock_out_hours integer not null default 12;

alter table public.restaurant_staff_module_settings
  drop constraint if exists restaurant_staff_module_settings_display_auto_clock_out_hours_check;

alter table public.restaurant_staff_module_settings
  add constraint restaurant_staff_module_settings_display_auto_clock_out_hours_check
  check (display_auto_clock_out_hours between 1 and 48);

comment on column public.restaurant_staff_module_settings.display_auto_clock_out_enabled is
  'Display-Zeiterfassung: offene Stempel nach Ablauf der Stunden automatisch schließen';

comment on column public.restaurant_staff_module_settings.display_auto_clock_out_hours is
  'Stunden bis Auto-Abmeldung (1–48), nur wirksam wenn display_auto_clock_out_enabled';
