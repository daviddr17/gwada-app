-- Feed Brand System: Palette, Foto-Look, Lieblings-Layouts pro Restaurant.

alter table public.restaurant_social_brand_kit
  add column if not exists palette_accent text not null default '#c4a574',
  add column if not exists palette_surface_dark text not null default '#1a1714',
  add column if not exists palette_surface_light text not null default '#f7f3ec',
  add column if not exists palette_secondary text,
  add column if not exists photo_look text not null default 'warm',
  add column if not exists preferred_layouts text[] not null
    default array['editorial_hero', 'atelier_split', 'signature_brand']::text[];

alter table public.restaurant_social_brand_kit
  drop constraint if exists restaurant_social_brand_kit_photo_look_check;

alter table public.restaurant_social_brand_kit
  add constraint restaurant_social_brand_kit_photo_look_check
  check (photo_look in ('warm', 'cool', 'neutral'));

comment on column public.restaurant_social_brand_kit.palette_accent is
  'Feed-Akzent (Hairlines, dezente Highlights) — unabhängig von App-Branding.';
comment on column public.restaurant_social_brand_kit.palette_surface_dark is
  'Dunkle Feed-Fläche (Panels, Soirée, Brand).';
comment on column public.restaurant_social_brand_kit.palette_surface_light is
  'Helle Feed-Fläche (Signature, ruhige Karten).';
comment on column public.restaurant_social_brand_kit.palette_secondary is
  'Optionale Zweitfarbe für den Feed; null = ungenutzt.';
comment on column public.restaurant_social_brand_kit.photo_look is
  'Gemeinsamer Foto-Grade für alle Autopilot-Posts: warm | cool | neutral.';
comment on column public.restaurant_social_brand_kit.preferred_layouts is
  'Gewählte Premium-Layouts für den Feed-Rhythmus (editorial_hero, atelier_split, …).';
