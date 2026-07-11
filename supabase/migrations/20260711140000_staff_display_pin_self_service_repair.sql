-- Live-Drift: 20260624290000 war in der History als applied, Spalte fehlte teils.
alter table public.restaurant_staff_module_settings
  add column if not exists profile_allow_display_pin_self_service boolean not null default false;

comment on column public.restaurant_staff_module_settings.profile_allow_display_pin_self_service is
  'Verknüpfte Mitarbeiter dürfen ihre 4-stellige Display-PIN im Profil neu setzen (Passwort erforderlich).';
