-- Bewertungen: Ansicht (Raster/Liste) für Profil & Website-Embed.
create table if not exists public.restaurant_review_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  default_embed_view text not null default 'grid'
    check (default_embed_view in ('grid', 'list')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists restaurant_review_settings_set_updated_at
  on public.restaurant_review_settings;

create trigger restaurant_review_settings_set_updated_at
  before update on public.restaurant_review_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_review_settings enable row level security;

drop policy if exists restaurant_review_settings_staff_select
  on public.restaurant_review_settings;
create policy restaurant_review_settings_staff_select
  on public.restaurant_review_settings for select
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists restaurant_review_settings_staff_write
  on public.restaurant_review_settings;
create policy restaurant_review_settings_staff_write
  on public.restaurant_review_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_review_settings is
  'Anzeige-Einstellungen für Bewertungen im Gästeprofil und Website-Embed.';
comment on column public.restaurant_review_settings.default_embed_view is
  'Raster (Masonry) oder Liste für Profil und Einbindung.';
