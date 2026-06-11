-- Erweiterte Benachrichtigungs-Module: Reservierungen (3), Schichten (2), Bestand, externe Bewertungen.

-- ---------------------------------------------------------------------------
-- notification_events: Modul-IDs erweitern
-- ---------------------------------------------------------------------------
update public.notification_events
set module = 'reservations_pending'
where module = 'reservations';

alter table public.notification_events
  drop constraint if exists notification_events_module_check;

alter table public.notification_events
  add constraint notification_events_module_check
  check (
    module in (
      'messages',
      'reviews',
      'changelog',
      'reservations_pending',
      'reservations_change_request',
      'reservations_cancellation',
      'staff_shift_start',
      'staff_shift_end',
      'inventory_low_stock'
    )
  );

-- ---------------------------------------------------------------------------
-- Reservierungen: Dismissals pro Modul
-- ---------------------------------------------------------------------------
alter table public.restaurant_reservation_notification_dismissals
  add column if not exists module text not null default 'reservations_pending';

alter table public.restaurant_reservation_notification_dismissals
  drop constraint if exists restaurant_reservation_notification_dismissals_module_check;

alter table public.restaurant_reservation_notification_dismissals
  add constraint restaurant_reservation_notification_dismissals_module_check
  check (
    module in (
      'reservations_pending',
      'reservations_change_request',
      'reservations_cancellation'
    )
  );

alter table public.restaurant_reservation_notification_dismissals
  drop constraint if exists restaurant_reservation_notification_dismissals_pkey;

alter table public.restaurant_reservation_notification_dismissals
  add primary key (profile_id, reservation_id, module);

-- ---------------------------------------------------------------------------
-- Schichten: Dismissals (Glocke)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_staff_shift_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  shift_id uuid not null references public.restaurant_staff_scheduled_shifts (id) on delete cascade,
  kind text not null check (kind in ('start', 'end')),
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, shift_id, kind)
);

create index if not exists restaurant_staff_shift_notification_dismissals_restaurant_idx
  on public.restaurant_staff_shift_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_staff_shift_notification_dismissals enable row level security;

create policy restaurant_staff_shift_notification_dismissals_rw_own_staff
  on public.restaurant_staff_shift_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

-- ---------------------------------------------------------------------------
-- Bestand: Niedrigbestand-Schwellwert + Dismissals
-- ---------------------------------------------------------------------------
alter table public.inventory_ingredients
  add column if not exists low_stock_threshold numeric(14, 4) not null default 0;

comment on column public.inventory_ingredients.low_stock_threshold is
  'Push/Glocke wenn current_stock <= Schwellwert (0 = nur leerer Bestand).';

create table if not exists public.restaurant_inventory_low_stock_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  ingredient_id text not null,
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id, ingredient_id),
  constraint restaurant_inventory_low_stock_dismissals_fk_ingredient
    foreign key (restaurant_id, ingredient_id)
    references public.inventory_ingredients (restaurant_id, id)
    on delete cascade
);

create index if not exists restaurant_inventory_low_stock_dismissals_restaurant_idx
  on public.restaurant_inventory_low_stock_dismissals (restaurant_id, profile_id);

alter table public.restaurant_inventory_low_stock_dismissals enable row level security;

create policy restaurant_inventory_low_stock_dismissals_rw_own_staff
  on public.restaurant_inventory_low_stock_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

-- inventory_replace_ingredients: low_stock_threshold mit speichern
create or replace function public.inventory_replace_ingredients(
  p_restaurant_id uuid,
  p_ingredients jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ing jsonb;
  ent jsonb;
  s int;
begin
  delete from public.inventory_stock_log_entries where restaurant_id = p_restaurant_id;
  delete from public.inventory_ingredients where restaurant_id = p_restaurant_id;

  for ing in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.inventory_ingredients (
      restaurant_id, id, name, unit, current_stock, low_stock_threshold,
      supplier_id, category_id, production_site_id, brand_id, is_active
    ) values (
      p_restaurant_id,
      ing->>'id',
      ing->>'name',
      ing->>'unit',
      coalesce((ing->>'currentStock')::numeric, 0),
      coalesce((ing->>'lowStockThreshold')::numeric, 0),
      ing->>'supplierId',
      ing->>'categoryId',
      ing->>'productionSiteId',
      ing->>'brandId',
      case when (ing ? 'active' and ing->'active' = 'false'::jsonb) then false else true end
    );

    s := 0;
    for ent in select * from jsonb_array_elements(coalesce(ing->'stockLog', '[]'::jsonb))
    loop
      insert into public.inventory_stock_log_entries (restaurant_id, ingredient_id, seq, entry)
      values (p_restaurant_id, ing->>'id', s, ent);
      s := s + 1;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push-Events: Reservierungen (pending / Änderung / Storno)
-- ---------------------------------------------------------------------------
drop trigger if exists reservations_notification_event on public.reservations;
drop function if exists public.trg_emit_notification_event_reservation();

create or replace function public.trg_emit_notification_event_reservation_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_code text;
begin
  select rs.code into status_code
  from public.reservation_statuses rs
  where rs.id = new.status_id;

  if status_code is distinct from 'pending' then
    return new;
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'reservations_pending',
    new.id::text,
    jsonb_build_object(
      'guestLabel', trim(concat_ws(' ', new.guest_first_name, new.guest_last_name)),
      'partySize', new.party_size,
      'startsAt', new.starts_at,
      'reservationNumber', new.reservation_number
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'reservations_pending'
      and e.reference_id = new.id::text
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

create trigger reservations_notification_pending_event
  after insert on public.reservations
  for each row
  execute function public.trg_emit_notification_event_reservation_pending();

create or replace function public.trg_emit_notification_event_reservation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_code text;
  new_code text;
  event_module text;
  guest_label text;
begin
  if new.status_id is not distinct from old.status_id then
    return new;
  end if;

  select rs.code into old_code
  from public.reservation_statuses rs
  where rs.id = old.status_id;

  select rs.code into new_code
  from public.reservation_statuses rs
  where rs.id = new.status_id;

  if new_code = 'change_requested' and old_code is distinct from 'change_requested' then
    event_module := 'reservations_change_request';
  elsif new_code = 'cancelled' and old_code is distinct from 'cancelled' then
    event_module := 'reservations_cancellation';
  else
    return new;
  end if;

  guest_label := trim(concat_ws(' ', new.guest_first_name, new.guest_last_name));

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    event_module,
    new.id::text || ':' || event_module,
    jsonb_build_object(
      'guestLabel', guest_label,
      'partySize', new.party_size,
      'startsAt', new.starts_at,
      'reservationNumber', new.reservation_number,
      'reservationId', new.id
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = event_module
      and e.reference_id = new.id::text || ':' || event_module
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

create trigger reservations_notification_status_event
  after update of status_id on public.reservations
  for each row
  execute function public.trg_emit_notification_event_reservation_status();

-- ---------------------------------------------------------------------------
-- Push-Events: Google/Facebook-Bewertungen aus Cache-Sync
-- ---------------------------------------------------------------------------
create or replace function public.trg_emit_notification_event_reviews_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_rating numeric;
  review_author text;
  review_preview text;
begin
  review_rating := coalesce((new.item->>'rating')::numeric, 0);
  review_author := coalesce(
    nullif(trim(new.item->>'authorName'), ''),
    'Gast'
  );
  review_preview := left(trim(coalesce(new.item->>'comment', '')), 120);

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'reviews',
    new.platform || ':' || new.external_id,
    jsonb_build_object(
      'rating', review_rating,
      'authorName', review_author,
      'commentPreview', review_preview,
      'platform', new.platform,
      'reviewId', new.platform || ':' || new.external_id
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'reviews'
      and e.reference_id = new.platform || ':' || new.external_id
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

drop trigger if exists restaurant_reviews_platform_cache_notification_event
  on public.restaurant_reviews_platform_cache;

create trigger restaurant_reviews_platform_cache_notification_event
  after insert on public.restaurant_reviews_platform_cache
  for each row
  execute function public.trg_emit_notification_event_reviews_cache();

-- ---------------------------------------------------------------------------
-- Push-Events: Bestand unter Schwellwert
-- ---------------------------------------------------------------------------
create or replace function public.trg_emit_notification_event_inventory_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_active, true) is not true then
    return new;
  end if;

  if new.current_stock > new.low_stock_threshold then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.current_stock <= old.low_stock_threshold
    and old.low_stock_threshold = new.low_stock_threshold then
    return new;
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'inventory_low_stock',
    new.id,
    jsonb_build_object(
      'ingredientId', new.id,
      'ingredientName', new.name,
      'currentStock', new.current_stock,
      'lowStockThreshold', new.low_stock_threshold,
      'unit', new.unit
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'inventory_low_stock'
      and e.reference_id = new.id
      and e.restaurant_id = new.restaurant_id
      and e.created_at > timezone('utc', now()) - interval '24 hours'
  );

  return new;
end;
$$;

drop trigger if exists inventory_ingredients_low_stock_notification_event
  on public.inventory_ingredients;

create trigger inventory_ingredients_low_stock_notification_event
  after insert or update of current_stock, low_stock_threshold, is_active
  on public.inventory_ingredients
  for each row
  execute function public.trg_emit_notification_event_inventory_low_stock();
