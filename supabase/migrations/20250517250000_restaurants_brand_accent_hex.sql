-- Branding: Akzentfarbe (#rrggbb) direkt am Restaurant (nicht nur in restaurant_app_state).

alter table public.restaurants
  add column if not exists brand_accent_hex text;

comment on column public.restaurants.brand_accent_hex is
  'UI-Akzentfarbe (#rrggbb) für dieses Restaurant; steuert --brand-accent. NULL = App-Standard.';
