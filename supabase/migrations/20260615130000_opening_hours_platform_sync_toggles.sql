-- Auto-Sync regulärer Öffnungszeiten zu Google/Facebook beim Speichern (opt-in).
alter table public.restaurant_opening_hours_settings
  add column if not exists sync_google_on_save boolean not null default false,
  add column if not exists sync_facebook_on_save boolean not null default false;

comment on column public.restaurant_opening_hours_settings.sync_google_on_save is
  'Reguläre Öffnungszeiten beim Speichern automatisch an Google Business übertragen.';
comment on column public.restaurant_opening_hours_settings.sync_facebook_on_save is
  'Reguläre Öffnungszeiten beim Speichern automatisch an Facebook übertragen.';
