-- Incremental PO add-line + stock deltas (no full-replace).

create or replace function public.inventory_purchase_order_add_line(
  p_restaurant_id uuid,
  p_supplier_id text,
  p_supplier_name text,
  p_created_by text,
  p_line_id text,
  p_ingredient_id text,
  p_ingredient_name text,
  p_brand_label text,
  p_quantity numeric,
  p_unit_id text,
  p_unit_label text,
  p_log_entry jsonb,
  p_order_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text;
  v_line_id text;
  v_qty numeric;
  v_created_order boolean := false;
  v_created_line boolean := false;
  v_sort int;
  v_now timestamptz := timezone('utc', now());
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text)::bigint);

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid quantity' using errcode = '22023';
  end if;
  if nullif(btrim(p_supplier_id), '') is null then
    raise exception 'supplier required' using errcode = '22023';
  end if;
  if nullif(btrim(p_ingredient_id), '') is null then
    raise exception 'ingredient required' using errcode = '22023';
  end if;

  if nullif(btrim(p_order_id), '') is not null then
    select id into v_order_id
    from public.inventory_purchase_orders
    where restaurant_id = p_restaurant_id
      and id = p_order_id
      and status = 'open';
  end if;

  if v_order_id is null then
    select id into v_order_id
    from public.inventory_purchase_orders
    where restaurant_id = p_restaurant_id
      and supplier_id = p_supplier_id
      and status = 'open'
    order by created_at desc
    limit 1;
  end if;

  if v_order_id is null then
    v_order_id := coalesce(nullif(btrim(p_order_id), ''), gen_random_uuid()::text);
    insert into public.inventory_purchase_orders (
      restaurant_id, id, supplier_id, supplier_name, status,
      created_at, created_by, created_by_user_source, delivery_date,
      status_updated_at
    ) values (
      p_restaurant_id,
      v_order_id,
      p_supplier_id,
      coalesce(nullif(btrim(p_supplier_name), ''), p_supplier_id),
      'open',
      v_now,
      coalesce(p_created_by, ''),
      null,
      null,
      v_now
    );
    v_created_order := true;
  elsif nullif(btrim(p_supplier_name), '') is not null then
    update public.inventory_purchase_orders
    set supplier_name = btrim(p_supplier_name)
    where restaurant_id = p_restaurant_id
      and id = v_order_id
      and supplier_name is distinct from btrim(p_supplier_name);
  end if;

  select id, quantity into v_line_id, v_qty
  from public.inventory_purchase_order_lines
  where restaurant_id = p_restaurant_id
    and order_id = v_order_id
    and ingredient_id = p_ingredient_id
  limit 1;

  if v_line_id is not null then
    v_qty := v_qty + p_quantity;
    update public.inventory_purchase_order_lines
    set
      quantity = v_qty,
      brand_label = nullif(btrim(coalesce(p_brand_label, '')), ''),
      ingredient_name = coalesce(nullif(btrim(p_ingredient_name), ''), ingredient_name),
      unit_id = coalesce(nullif(btrim(p_unit_id), ''), unit_id),
      unit_label = coalesce(nullif(btrim(p_unit_label), ''), unit_label)
    where restaurant_id = p_restaurant_id
      and order_id = v_order_id
      and id = v_line_id;
  else
    v_line_id := coalesce(nullif(btrim(p_line_id), ''), gen_random_uuid()::text);
    v_qty := p_quantity;
    insert into public.inventory_purchase_order_lines (
      restaurant_id, order_id, id, ingredient_id, ingredient_name, brand_label,
      quantity, unit_id, unit_label
    ) values (
      p_restaurant_id,
      v_order_id,
      v_line_id,
      p_ingredient_id,
      coalesce(nullif(btrim(p_ingredient_name), ''), p_ingredient_id),
      nullif(btrim(coalesce(p_brand_label, '')), ''),
      v_qty,
      coalesce(nullif(btrim(p_unit_id), ''), ''),
      coalesce(nullif(btrim(p_unit_label), ''), '')
    );
    v_created_line := true;
  end if;

  select coalesce(max(sort_order), -1) + 1
  into v_sort
  from public.inventory_purchase_order_log_entries
  where restaurant_id = p_restaurant_id and order_id = v_order_id;

  insert into public.inventory_purchase_order_log_entries (
    restaurant_id, order_id, sort_order, entry
  ) values (
    p_restaurant_id, v_order_id, v_sort, coalesce(p_log_entry, '{}'::jsonb)
  );

  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);

  return jsonb_build_object(
    'order_id', v_order_id,
    'line_id', v_line_id,
    'quantity', v_qty,
    'created_order', v_created_order,
    'created_line', v_created_line
  );
end;
$$;

grant execute on function public.inventory_purchase_order_add_line(
  uuid, text, text, text, text, text, text, text, numeric, text, text, jsonb, text
) to anon, authenticated, service_role;

create or replace function public.inventory_ingredients_apply_stock_deltas(
  p_restaurant_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_ingredient_id text;
  v_delta numeric;
  v_stock numeric;
  v_seq int;
  v_updated int := 0;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text)::bigint);

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_ingredient_id := nullif(btrim(coalesce(v_item->>'ingredient_id', '')), '');
    v_delta := coalesce((v_item->>'delta')::numeric, 0);
    if v_ingredient_id is null or v_delta = 0 then
      continue;
    end if;

    select current_stock into v_stock
    from public.inventory_ingredients
    where restaurant_id = p_restaurant_id and id = v_ingredient_id
    for update;

    if not found then
      continue;
    end if;

    update public.inventory_ingredients
    set current_stock = coalesce(current_stock, 0) + v_delta
    where restaurant_id = p_restaurant_id and id = v_ingredient_id;

    select coalesce(max(seq), -1) + 1
    into v_seq
    from public.inventory_stock_log_entries
    where restaurant_id = p_restaurant_id and ingredient_id = v_ingredient_id;

    insert into public.inventory_stock_log_entries (
      restaurant_id, ingredient_id, seq, entry
    ) values (
      p_restaurant_id,
      v_ingredient_id,
      v_seq,
      coalesce(v_item->'stock_log', '{}'::jsonb)
    );

    v_updated := v_updated + 1;
  end loop;

  if v_updated > 0 then
    perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
  end if;

  return jsonb_build_object('updated', v_updated);
end;
$$;

grant execute on function public.inventory_ingredients_apply_stock_deltas(
  uuid, jsonb
) to anon, authenticated, service_role;
