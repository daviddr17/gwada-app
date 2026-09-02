-- Fix: pg-safeupdate blockiert DELETE ohne WHERE auf der Temp-Tabelle
-- in inventory_replace_purchase_orders → „DELETE requires a WHERE clause“
-- (Status-RPC war ok; Folgesave/Full-Replace schlug fehl).

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
  v_status text;
  v_status_updated_at timestamptz;
  v_client_status_updated_at timestamptz;
  v_prev_status text;
  v_prev_status_updated_at timestamptz;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text)::bigint);

  create temporary table if not exists _gwada_po_prev_status (
    id text primary key,
    status text not null,
    status_updated_at timestamptz not null
  ) on commit drop;

  -- safeupdate: WHERE Pflicht (auch auf Temp-Tabellen)
  delete from _gwada_po_prev_status where true;

  insert into _gwada_po_prev_status (id, status, status_updated_at)
  select id, status, status_updated_at
  from public.inventory_purchase_orders
  where restaurant_id = p_restaurant_id;

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

    v_status := coalesce(nullif(trim(ord->>'status'), ''), 'open');
    v_client_status_updated_at := null;
    begin
      if nullif(trim(ord->>'statusUpdatedAt'), '') is not null then
        v_client_status_updated_at := (ord->>'statusUpdatedAt')::timestamptz;
      end if;
    exception
      when others then
        v_client_status_updated_at := null;
    end;

    v_prev_status := null;
    v_prev_status_updated_at := null;
    select p.status, p.status_updated_at
      into v_prev_status, v_prev_status_updated_at
    from _gwada_po_prev_status p
    where p.id = ord->>'id';

    if v_prev_status_updated_at is not null
       and (
         v_client_status_updated_at is null
         or v_prev_status_updated_at > v_client_status_updated_at
       ) then
      v_status := v_prev_status;
      v_status_updated_at := v_prev_status_updated_at;
    else
      v_status_updated_at := coalesce(
        v_client_status_updated_at,
        timezone('utc', now())
      );
    end if;

    insert into public.inventory_purchase_orders (
      restaurant_id, id, supplier_id, supplier_name, status,
      created_at, created_by, created_by_user_source, delivery_date,
      status_updated_at
    ) values (
      p_restaurant_id,
      ord->>'id',
      ord->>'supplierId',
      ord->>'supplierName',
      v_status,
      coalesce((ord->>'createdAt')::timestamptz, timezone('utc', now())),
      coalesce(ord->>'createdBy', ''),
      nullif(ord->>'createdByUserSource', ''),
      dd,
      v_status_updated_at
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
