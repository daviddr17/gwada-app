-- Embed-Darstellung pro Restaurant und Modul (Schrift hell/dunkel).
create table if not exists public.restaurant_embed_appearance (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  widget text not null,
  text_theme text not null default 'dark',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, widget),
  constraint restaurant_embed_appearance_widget_check check (
    widget in (
      'opening_hours',
      'menu',
      'reviews',
      'news',
      'reservation',
      'gallery'
    )
  ),
  constraint restaurant_embed_appearance_text_theme_check check (
    text_theme in ('light', 'dark')
  )
);

drop trigger if exists restaurant_embed_appearance_set_updated_at
  on public.restaurant_embed_appearance;

create trigger restaurant_embed_appearance_set_updated_at
  before update on public.restaurant_embed_appearance
  for each row execute function public.set_updated_at();

alter table public.restaurant_embed_appearance enable row level security;

drop policy if exists restaurant_embed_appearance_staff_select
  on public.restaurant_embed_appearance;
create policy restaurant_embed_appearance_staff_select
  on public.restaurant_embed_appearance for select
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists restaurant_embed_appearance_staff_write
  on public.restaurant_embed_appearance;
create policy restaurant_embed_appearance_staff_write
  on public.restaurant_embed_appearance for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_embed_appearance is
  'Einbindungs-Darstellung: helle oder dunkle Schrift pro Widget.';
comment on column public.restaurant_embed_appearance.text_theme is
  'light = helle Schrift (dunkler Website-Hintergrund), dark = dunkle Schrift (heller Hintergrund).';
