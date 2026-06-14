-- Platform-wide sidebar module order (Superadmin → Allgemein).

alter table public.platform_app_settings
  add column if not exists sidebar_module_order jsonb;

comment on column public.platform_app_settings.sidebar_module_order is
  'Ordered list of sidebar module ids (text[] as jsonb array). Null = default order.';
