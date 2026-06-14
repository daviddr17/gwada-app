-- Öffnungszeiten-Embed: Footer-Text + Anzeigeoptionen.
create table if not exists public.restaurant_opening_hours_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  embed_footer_text text,
  embed_show_kitchen_hours boolean not null default true,
  embed_show_exceptions boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_opening_hours_settings
  drop constraint if exists restaurant_opening_hours_settings_embed_footer_len_check;

alter table public.restaurant_opening_hours_settings
  add constraint restaurant_opening_hours_settings_embed_footer_len_check
  check (
    embed_footer_text is null
    or char_length(embed_footer_text) <= 2000
  );

drop trigger if exists restaurant_opening_hours_settings_set_updated_at
  on public.restaurant_opening_hours_settings;

create trigger restaurant_opening_hours_settings_set_updated_at
  before update on public.restaurant_opening_hours_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_opening_hours_settings enable row level security;

drop policy if exists restaurant_opening_hours_settings_staff_select
  on public.restaurant_opening_hours_settings;
create policy restaurant_opening_hours_settings_staff_select
  on public.restaurant_opening_hours_settings for select
  using (public.user_has_restaurant_access(restaurant_id));

drop policy if exists restaurant_opening_hours_settings_staff_write
  on public.restaurant_opening_hours_settings;
create policy restaurant_opening_hours_settings_staff_write
  on public.restaurant_opening_hours_settings for all
  using (public.user_has_restaurant_access(restaurant_id))
  with check (public.user_has_restaurant_access(restaurant_id));

comment on table public.restaurant_opening_hours_settings is
  'Embed- und Anzeigeoptionen für Öffnungszeiten (Website-Widget).';
comment on column public.restaurant_opening_hours_settings.embed_footer_text is
  'Optionaler Hinweistext unter den Öffnungszeiten im Embed.';
comment on column public.restaurant_opening_hours_settings.embed_show_kitchen_hours is
  'Küchenzeiten im Embed anzeigen, wenn aktiviert.';
comment on column public.restaurant_opening_hours_settings.embed_show_exceptions is
  'Sondertermine (Ausnahmen) im Embed anzeigen.';
