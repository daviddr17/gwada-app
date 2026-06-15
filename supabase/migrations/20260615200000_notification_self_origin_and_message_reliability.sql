-- Self-origin: Akteur für Glocke/Push; Bestand-Push mit actorProfileId.
-- Reservierungen: letzter Status-Akteur; Schichten: letzter Bearbeiter; Bestand: letzte Bestandsänderung.

alter table public.reservations
  add column if not exists last_status_changed_by_profile_id uuid
    references public.profiles (id) on delete set null;

comment on column public.reservations.last_status_changed_by_profile_id is
  'Profil, das status_id zuletzt geändert hat (auth.uid beim Update); null = Gast/System.';

create or replace function public.reservations_track_status_changer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status_id is distinct from old.status_id then
    new.last_status_changed_by_profile_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_track_status_changer on public.reservations;

create trigger reservations_track_status_changer
  before update of status_id on public.reservations
  for each row
  execute function public.reservations_track_status_changer();

alter table public.restaurant_staff_scheduled_shifts
  add column if not exists last_modified_by_profile_id uuid
    references auth.users (id) on delete set null;

comment on column public.restaurant_staff_scheduled_shifts.last_modified_by_profile_id is
  'Profil, das die Schicht zuletzt bearbeitet hat (Dashboard).';

create or replace function public.restaurant_staff_scheduled_shifts_track_modifier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.last_modified_by_profile_id := coalesce(new.created_by, auth.uid());
    return new;
  end if;
  new.last_modified_by_profile_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists restaurant_staff_scheduled_shifts_track_modifier
  on public.restaurant_staff_scheduled_shifts;

create trigger restaurant_staff_scheduled_shifts_track_modifier
  before insert or update on public.restaurant_staff_scheduled_shifts
  for each row
  execute function public.restaurant_staff_scheduled_shifts_track_modifier();

alter table public.inventory_ingredients
  add column if not exists last_stock_changed_by_profile_id uuid
    references public.profiles (id) on delete set null;

comment on column public.inventory_ingredients.last_stock_changed_by_profile_id is
  'Profil bei letzter Änderung von current_stock (Bestand-UI).';

-- inventory_replace_ingredients: last_stock_changed_by_profile_id bei Bestandsänderung
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
  keep_ids text[] := array[]::text[];
begin
  for ing in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    keep_ids := array_append(keep_ids, ing->>'id');
  end loop;

  delete from public.inventory_stock_log_entries
  where restaurant_id = p_restaurant_id
    and ingredient_id <> all (coalesce(keep_ids, array[]::text[]));

  delete from public.inventory_ingredients
  where restaurant_id = p_restaurant_id
    and id <> all (coalesce(keep_ids, array[]::text[]));

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
    )
    on conflict (restaurant_id, id) do update set
      name = excluded.name,
      unit = excluded.unit,
      current_stock = excluded.current_stock,
      low_stock_threshold = excluded.low_stock_threshold,
      supplier_id = excluded.supplier_id,
      category_id = excluded.category_id,
      production_site_id = excluded.production_site_id,
      brand_id = excluded.brand_id,
      is_active = excluded.is_active,
      last_stock_changed_by_profile_id = case
        when public.inventory_ingredients.current_stock is distinct from excluded.current_stock
          then auth.uid()
        else public.inventory_ingredients.last_stock_changed_by_profile_id
      end;

    delete from public.inventory_stock_log_entries
    where restaurant_id = p_restaurant_id
      and ingredient_id = ing->>'id';

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

create or replace function public.trg_emit_notification_event_inventory_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  day_bucket text;
  ref_key text;
begin
  if coalesce(new.is_active, true) is not true then
    return new;
  end if;

  if new.current_stock > new.low_stock_threshold then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.current_stock <= old.low_stock_threshold
      and old.low_stock_threshold = new.low_stock_threshold then
      return new;
    end if;
    if old.current_stock <= new.low_stock_threshold
      and new.current_stock <= new.low_stock_threshold then
      return new;
    end if;
  end if;

  day_bucket := to_char(timezone('utc', now()), 'YYYY-MM-DD');
  ref_key := new.id::text || ':' || day_bucket;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'inventory_low_stock',
    ref_key,
    jsonb_build_object(
      'ingredientId', new.id,
      'ingredientName', new.name,
      'currentStock', new.current_stock,
      'lowStockThreshold', new.low_stock_threshold,
      'unit', new.unit,
      'actorProfileId', auth.uid()
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'inventory_low_stock'
      and e.reference_id = ref_key
      and e.restaurant_id = new.restaurant_id
  );

  return new;
end;
$$;

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
      'reservationId', new.id,
      'actorProfileId', auth.uid(),
      'guestPhone', nullif(trim(coalesce(new.guest_phone, '')), ''),
      'guestEmail', nullif(trim(coalesce(new.guest_email, '')), ''),
      'notesPreview', left(trim(coalesce(new.notes, '')), 200)
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
