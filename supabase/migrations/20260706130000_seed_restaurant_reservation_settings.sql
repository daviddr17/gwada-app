-- Reservierungs-Einstellungen pro Restaurant: Backfill + Auto-Seed bei neuen Restaurants.
-- Verhindert WhatsApp/E-Mail-Dispatch skip "no_settings", wenn noch nie Einstellungen gespeichert wurden.

insert into public.restaurant_reservation_settings (restaurant_id)
select r.id
from public.restaurants r
where not exists (
  select 1
  from public.restaurant_reservation_settings s
  where s.restaurant_id = r.id
);

create or replace function public.seed_restaurant_reservation_settings_for_restaurant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.restaurant_reservation_settings (restaurant_id)
  values (new.id)
  on conflict (restaurant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists restaurants_seed_reservation_settings on public.restaurants;
create trigger restaurants_seed_reservation_settings
  after insert on public.restaurants
  for each row execute function public.seed_restaurant_reservation_settings_for_restaurant();

comment on function public.seed_restaurant_reservation_settings_for_restaurant() is
  'Legt Standard-Reservierungseinstellungen (Spalten-Defaults) für neue Restaurants an.';
