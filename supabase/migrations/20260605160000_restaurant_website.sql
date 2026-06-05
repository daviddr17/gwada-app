-- Öffentliche Restaurant-Website (Stammdaten, nicht JSON-Cache)
alter table public.restaurants
  add column if not exists website text;

comment on column public.restaurants.website is
  'Öffentliche Restaurant-Website (https://…), gepflegt unter Einstellungen → Restaurant.';

alter table public.restaurants
  drop constraint if exists restaurants_website_len_check;

alter table public.restaurants
  add constraint restaurants_website_len_check
  check (website is null or char_length(website) <= 500);
