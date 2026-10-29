-- Per-restaurant display typeface for KI-Post / Autopilot creatives.
alter table public.restaurant_social_brand_kit
  add column if not exists display_font text not null default 'noto_serif';

alter table public.restaurant_social_brand_kit
  drop constraint if exists restaurant_social_brand_kit_display_font_check;

alter table public.restaurant_social_brand_kit
  add constraint restaurant_social_brand_kit_display_font_check
  check (display_font in ('inter', 'public_sans', 'noto_serif', 'tinos', 'arimo'));

comment on column public.restaurant_social_brand_kit.display_font is
  'Display typeface for social template headlines (Inter, Public Sans, Noto Serif, Tinos, Arimo).';
