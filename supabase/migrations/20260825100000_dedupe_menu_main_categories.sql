-- Doppelte Hauptkategorien pro Restaurant (z. B. zweimal „Speisen“) bereinigen
-- und künftige Duplikate per Unique-Index verhindern.

with ranked as (
  select
    mmc.id,
    mmc.restaurant_id,
    lower(trim(mmc.name)) as name_key,
    row_number() over (
      partition by mmc.restaurant_id, lower(trim(mmc.name))
      order by
        (
          select count(*)
          from public.menu_categories mc
          where mc.main_category_id = mmc.id
        ) desc,
        mmc.sort_order asc,
        mmc.created_at asc,
        mmc.id asc
    ) as rn
  from public.menu_main_categories mmc
),
canonical as (
  select id as keep_id, restaurant_id, name_key
  from ranked
  where rn = 1
),
dupes as (
  select r.id as dupe_id, c.keep_id
  from ranked r
  join canonical c
    on c.restaurant_id = r.restaurant_id
   and c.name_key = r.name_key
  where r.rn > 1
)
update public.menu_categories mc
set main_category_id = d.keep_id
from dupes d
where mc.main_category_id = d.dupe_id;

with ranked as (
  select
    mmc.id,
    row_number() over (
      partition by mmc.restaurant_id, lower(trim(mmc.name))
      order by
        (
          select count(*)
          from public.menu_categories mc
          where mc.main_category_id = mmc.id
        ) desc,
        mmc.sort_order asc,
        mmc.created_at asc,
        mmc.id asc
    ) as rn
  from public.menu_main_categories mmc
)
delete from public.menu_main_categories mmc
using ranked r
where mmc.id = r.id
  and r.rn > 1;

create unique index if not exists menu_main_categories_restaurant_name_unique_idx
  on public.menu_main_categories (restaurant_id, lower(trim(name)));
