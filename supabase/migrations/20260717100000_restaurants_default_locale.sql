-- Restaurant source language for embeds (UI default + content MT source).
alter table public.restaurants
  add column if not exists default_locale text not null default 'de';

comment on column public.restaurants.default_locale is
  'Guest-facing default language (short code: de, en, …). Embed flag picker starts here; content MT uses it as source.';

alter table public.restaurants
  drop constraint if exists restaurants_default_locale_check;

alter table public.restaurants
  add constraint restaurants_default_locale_check
  check (default_locale in ('de', 'en', 'es', 'fr', 'it', 'tr', 'ar', 'zh'));
