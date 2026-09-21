-- Heute: leere Zutaten ausblenden bis nach nächster Auffüllung wieder 0.

create table if not exists public.restaurant_inventory_empty_stock_heute_snoozes (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  ingredient_id text not null,
  snoozed_at timestamptz not null default timezone('utc', now()),
  snoozed_by_profile_id uuid references public.profiles (id) on delete set null,
  primary key (restaurant_id, ingredient_id),
  constraint restaurant_inventory_empty_stock_heute_snoozes_fk_ingredient
    foreign key (restaurant_id, ingredient_id)
    references public.inventory_ingredients (restaurant_id, id)
    on delete cascade
);

create index if not exists restaurant_inventory_empty_stock_heute_snoozes_restaurant_idx
  on public.restaurant_inventory_empty_stock_heute_snoozes (restaurant_id);

alter table public.restaurant_inventory_empty_stock_heute_snoozes enable row level security;

drop policy if exists restaurant_inventory_empty_stock_heute_snoozes_rw_staff
  on public.restaurant_inventory_empty_stock_heute_snoozes;
create policy restaurant_inventory_empty_stock_heute_snoozes_rw_staff
  on public.restaurant_inventory_empty_stock_heute_snoozes for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_inventory_empty_stock_heute_snoozes is
  'Leerbestand in Dashboard-Heute ausgeblendet bis current_stock wieder > 0 war (dann erneut sichtbar bei 0).';

create or replace function public.inventory_clear_empty_heute_snooze_on_restock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_stock > 0 then
    delete from public.restaurant_inventory_empty_stock_heute_snoozes
    where restaurant_id = new.restaurant_id
      and ingredient_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_ingredients_clear_empty_heute_snooze
  on public.inventory_ingredients;

create trigger inventory_ingredients_clear_empty_heute_snooze
  after update of current_stock on public.inventory_ingredients
  for each row
  when (new.current_stock is distinct from old.current_stock)
  execute function public.inventory_clear_empty_heute_snooze_on_restock();
