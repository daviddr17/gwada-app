-- Anleitungen: Kategorien (CRUD unter guides.*, optional category_id)

create table public.restaurant_guide_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_guide_categories_name_len check (char_length(name) between 1 and 120)
);

create unique index restaurant_guide_categories_restaurant_name_active_uidx
  on public.restaurant_guide_categories (restaurant_id, lower(name))
  where is_active;

create index restaurant_guide_categories_restaurant_sort_idx
  on public.restaurant_guide_categories (restaurant_id, sort_order, name);

create trigger restaurant_guide_categories_set_updated_at
  before update on public.restaurant_guide_categories
  for each row execute function public.set_updated_at();

alter table public.restaurant_guides
  add column category_id uuid references public.restaurant_guide_categories (id) on delete set null;

create index restaurant_guides_category_id_idx
  on public.restaurant_guides (category_id)
  where category_id is not null;

create or replace function public.enforce_restaurant_guide_category_restaurant()
returns trigger
language plpgsql
as $$
begin
  if new.category_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.restaurant_guide_categories c
    where c.id = new.category_id
      and c.restaurant_id = new.restaurant_id
  ) then
    raise exception 'restaurant_guides.category_id must reference restaurant_guide_categories for the same restaurant_id';
  end if;
  return new;
end;
$$;

create trigger restaurant_guides_category_restaurant
  before insert or update of category_id, restaurant_id on public.restaurant_guides
  for each row execute function public.enforce_restaurant_guide_category_restaurant();

alter table public.restaurant_guide_categories enable row level security;

create policy restaurant_guide_categories_select
  on public.restaurant_guide_categories for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.read'));

create policy restaurant_guide_categories_insert
  on public.restaurant_guide_categories for insert to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'guides.create'));

create policy restaurant_guide_categories_update
  on public.restaurant_guide_categories for update to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'guides.update'));

create policy restaurant_guide_categories_delete
  on public.restaurant_guide_categories for delete to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.delete'));
