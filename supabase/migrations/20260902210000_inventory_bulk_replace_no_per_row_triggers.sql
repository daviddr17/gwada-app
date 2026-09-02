-- Fix: Full-Replace von Bestellungen/Zutaten darf nicht pro Zeile Live-Signal +
-- Heute-Feed feuern (Tausende Trigger → statement_timeout → Speichern rollt zurück).
-- Symptom: „Als bestellt“ toastet optimistisch, dann „Speichern fehlgeschlagen: … timeout“,
-- Status springt wieder auf offen (z. B. SB Union / Zur Schlagd).

-- Session-Flag: true = Bulk-Replace läuft (transaction-local).
create or replace function public.inventory_bulk_replace_active()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('gwada.inventory_bulk_replace', true), ''), '0') = '1';
$$;

create or replace function public.bump_restaurant_inventory_live_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  -- Während Full-Replace: kein per-row Upsert (Hot-Row-Lock + Timeout).
  if public.inventory_bulk_replace_active() then
    return coalesce(new, old);
  end if;

  rid := coalesce(new.restaurant_id, old.restaurant_id);
  if rid is null then
    return coalesce(new, old);
  end if;

  insert into public.restaurant_inventory_live_signals (restaurant_id, revision, updated_at)
  values (rid, 1, now())
  on conflict (restaurant_id) do update
  set
    revision = public.restaurant_inventory_live_signals.revision + 1,
    updated_at = now();

  return coalesce(new, old);
end;
$$;

create or replace function public.bump_restaurant_inventory_live_signal_once(
  p_restaurant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_restaurant_id is null then
    return;
  end if;
  insert into public.restaurant_inventory_live_signals (restaurant_id, revision, updated_at)
  values (p_restaurant_id, 1, now())
  on conflict (restaurant_id) do update
  set
    revision = public.restaurant_inventory_live_signals.revision + 1,
    updated_at = now();
end;
$$;

create or replace function public.trg_emit_notification_event_inventory_po_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_entry jsonb;
  v_supplier_name text;
  v_staff_name text;
begin
  -- Full-Replace re-insertiert die gesamte History — kein Feed-Spam / Timeout.
  if public.inventory_bulk_replace_active() then
    return new;
  end if;

  v_entry := new.entry;
  v_kind := v_entry->>'kind';

  if v_kind is null or v_kind = 'legacy_adjustment' then
    return new;
  end if;

  if exists (
    select 1
    from public.notification_events e
    where e.restaurant_id = new.restaurant_id
      and e.module = 'inventory_po_activity'
      and e.reference_id = new.id::text
  ) then
    return new;
  end if;

  select po.supplier_name
  into v_supplier_name
  from public.inventory_purchase_orders po
  where po.restaurant_id = new.restaurant_id
    and po.id = new.order_id;

  v_staff_name := trim(
    coalesce(v_entry->>'userFirstName', '') || ' ' || coalesce(v_entry->>'userLastName', '')
  );
  if v_staff_name = '' then
    v_staff_name := coalesce(nullif(trim(v_entry->>'userName'), ''), '');
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  values (
    new.restaurant_id,
    'inventory_po_activity',
    new.id::text,
    jsonb_build_object(
      'logEntryId', new.id,
      'orderId', new.order_id,
      'supplierName', coalesce(v_supplier_name, ''),
      'kind', v_kind,
      'ingredientId', coalesce(v_entry->>'ingredientId', ''),
      'ingredientName', coalesce(v_entry->>'ingredientName', ''),
      'quantity', v_entry->'quantity',
      'fromQuantity', v_entry->'fromQuantity',
      'toQuantity', v_entry->'toQuantity',
      'unitLabel', coalesce(v_entry->>'unitLabel', ''),
      'fromStatus', v_entry->>'fromStatus',
      'toStatus', v_entry->>'toStatus',
      'deliveryStatus', v_entry->>'deliveryStatus',
      'staffName', v_staff_name,
      'at', coalesce(v_entry->>'at', timezone('utc', now())::text)
    )
  );

  return new;
end;
$$;

create or replace function public.trg_emit_notification_event_inventory_stock_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry jsonb;
  v_ingredient_name text;
  v_staff_name text;
begin
  if public.inventory_bulk_replace_active() then
    return new;
  end if;

  v_entry := new.entry;

  if exists (
    select 1
    from public.notification_events e
    where e.restaurant_id = new.restaurant_id
      and e.module = 'inventory_stock_activity'
      and e.reference_id = new.id::text
  ) then
    return new;
  end if;

  select i.name
  into v_ingredient_name
  from public.inventory_ingredients i
  where i.restaurant_id = new.restaurant_id
    and i.id = new.ingredient_id;

  v_staff_name := trim(
    coalesce(v_entry->>'userFirstName', '') || ' ' || coalesce(v_entry->>'userLastName', '')
  );
  if v_staff_name = '' then
    v_staff_name := coalesce(nullif(trim(v_entry->>'userName'), ''), '');
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  values (
    new.restaurant_id,
    'inventory_stock_activity',
    new.id::text,
    jsonb_build_object(
      'logEntryId', new.id,
      'ingredientId', new.ingredient_id,
      'ingredientName', coalesce(v_ingredient_name, coalesce(v_entry->>'ingredientName', '')),
      'delta', v_entry->'delta',
      'fromStock', v_entry->'fromStock',
      'toStock', v_entry->'toStock',
      'unitLabel', coalesce(v_entry->>'unitLabel', ''),
      'staffName', v_staff_name,
      'at', coalesce(v_entry->>'at', timezone('utc', now())::text)
    )
  );

  return new;
end;
$$;

-- PO Full-Replace: Bulk-Flag + einmaliges Live-Signal + stabile Log-IDs
create or replace function public.inventory_replace_purchase_orders(
  p_restaurant_id uuid,
  p_orders jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ord jsonb;
  ln jsonb;
  lg jsonb;
  s int;
  dd date;
  v_log_id uuid;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform set_config('gwada.inventory_bulk_replace', '1', true);

  delete from public.inventory_purchase_order_log_entries where restaurant_id = p_restaurant_id;
  delete from public.inventory_purchase_order_lines where restaurant_id = p_restaurant_id;
  delete from public.inventory_purchase_orders where restaurant_id = p_restaurant_id;

  for ord in select * from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb))
  loop
    if nullif(trim(ord->>'supplierId'), '') is not null then
      insert into public.inventory_suppliers (
        restaurant_id, id, name, sort_order, is_active
      ) values (
        p_restaurant_id,
        ord->>'supplierId',
        coalesce(nullif(trim(ord->>'supplierName'), ''), ord->>'supplierId'),
        0,
        true
      )
      on conflict (restaurant_id, id) do update
        set is_active = true;
    end if;

    dd := null;
    if ord ? 'deliveryDate' and nullif(trim(ord->>'deliveryDate'), '') is not null then
      dd := (ord->>'deliveryDate')::date;
    end if;

    insert into public.inventory_purchase_orders (
      restaurant_id, id, supplier_id, supplier_name, status,
      created_at, created_by, created_by_user_source, delivery_date
    ) values (
      p_restaurant_id,
      ord->>'id',
      ord->>'supplierId',
      ord->>'supplierName',
      ord->>'status',
      coalesce((ord->>'createdAt')::timestamptz, timezone('utc', now())),
      coalesce(ord->>'createdBy', ''),
      nullif(ord->>'createdByUserSource', ''),
      dd
    );

    for ln in select * from jsonb_array_elements(coalesce(ord->'lines', '[]'::jsonb))
    loop
      insert into public.inventory_purchase_order_lines (
        restaurant_id, order_id, id, ingredient_id, ingredient_name, brand_label,
        quantity, unit_id, unit_label, delivered_at,
        delivery_status, delivered_quantity, delivery_note
      ) values (
        p_restaurant_id,
        ord->>'id',
        ln->>'id',
        ln->>'ingredientId',
        ln->>'ingredientName',
        nullif(ln->>'brandLabel', ''),
        (ln->>'quantity')::numeric,
        ln->>'unitId',
        ln->>'unitLabel',
        case
          when nullif(trim(ln->>'deliveredAt'), '') is null then null
          else (ln->>'deliveredAt')::timestamptz
        end,
        nullif(trim(ln->>'deliveryStatus'), ''),
        case
          when ln ? 'deliveredQuantity' and nullif(trim(ln->>'deliveredQuantity'), '') is not null
            then (ln->>'deliveredQuantity')::numeric
          else null
        end,
        nullif(trim(ln->>'deliveryNote'), '')
      );
    end loop;

    s := 0;
    for lg in select * from jsonb_array_elements(coalesce(ord->'log', '[]'::jsonb))
    loop
      v_log_id := null;
      begin
        if nullif(trim(lg->>'id'), '') is not null then
          v_log_id := (lg->>'id')::uuid;
        end if;
      exception
        when invalid_text_representation then
          v_log_id := null;
      end;

      if v_log_id is null then
        insert into public.inventory_purchase_order_log_entries (
          restaurant_id, order_id, sort_order, entry
        ) values (p_restaurant_id, ord->>'id', s, lg);
      else
        insert into public.inventory_purchase_order_log_entries (
          id, restaurant_id, order_id, sort_order, entry
        ) values (v_log_id, p_restaurant_id, ord->>'id', s, lg)
        on conflict (id) do update
          set
            restaurant_id = excluded.restaurant_id,
            order_id = excluded.order_id,
            sort_order = excluded.sort_order,
            entry = excluded.entry;
      end if;
      s := s + 1;
    end loop;
  end loop;

  perform set_config('gwada.inventory_bulk_replace', '0', true);
  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
end;
$$;

-- Ingredients Full-Replace: gleiches Bulk-Flag + einmaliges Signal
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
  v_price numeric(14, 4);
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform set_config('gwada.inventory_bulk_replace', '1', true);

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
    v_price := null;
    if ing ? 'purchaseUnitPrice' and ing->>'purchaseUnitPrice' is not null
      and btrim(ing->>'purchaseUnitPrice') <> '' then
      v_price := (ing->>'purchaseUnitPrice')::numeric(14, 4);
    end if;

    insert into public.inventory_ingredients (
      restaurant_id, id, name, unit, current_stock, low_stock_threshold,
      supplier_id, category_id, production_site_id, brand_id, is_active,
      purchase_unit_price
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
      case when (ing ? 'active' and ing->'active' = 'false'::jsonb) then false else true end,
      v_price
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
      purchase_unit_price = excluded.purchase_unit_price;

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

  perform set_config('gwada.inventory_bulk_replace', '0', true);
  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
end;
$$;
