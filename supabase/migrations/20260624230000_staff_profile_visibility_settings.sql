-- Profil-Self-Service: Restaurant steuert sichtbare MA-Bereiche im Profil.

alter table public.restaurant_staff_module_settings
  add column if not exists profile_show_work_hours boolean not null default true,
  add column if not exists profile_show_shift_plan boolean not null default true,
  add column if not exists profile_show_documents boolean not null default true;

comment on column public.restaurant_staff_module_settings.profile_show_work_hours is
  'Mitarbeiter mit Profil-Verknüpfung sehen „Meine Arbeitszeiten“ im Profil.';
comment on column public.restaurant_staff_module_settings.profile_show_shift_plan is
  'Mitarbeiter mit Profil-Verknüpfung sehen „Dienstplan“ im Profil.';
comment on column public.restaurant_staff_module_settings.profile_show_documents is
  'Mitarbeiter mit Profil-Verknüpfung sehen „Meine Dokumente“ im Profil.';
