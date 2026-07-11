-- News-Embed: Timeline (Liste) als Standard — wie Events-Modul
alter table public.restaurant_news_settings
  alter column default_embed_view set default 'list';

update public.restaurant_news_settings
set default_embed_view = 'list'
where default_embed_view = 'grid';

comment on column public.restaurant_news_settings.default_embed_view is
  'Profil & Einbindung: list = Timeline (Standard), grid = Raster/Kacheln';
