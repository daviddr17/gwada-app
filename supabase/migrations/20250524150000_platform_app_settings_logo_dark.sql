-- Separates App-Logo für Hell- und Dunkelmodus (Favicon bleibt einheitlich).

alter table public.platform_app_settings
  add column if not exists logo_dark_path text;
