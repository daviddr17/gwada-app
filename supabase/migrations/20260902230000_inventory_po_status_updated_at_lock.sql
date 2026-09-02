-- Multi-User-Sicherheit: Status darf durch parallelen Full-Replace nicht regressieren.
-- status_updated_at + xact advisory lock serialisieren PO-Writes pro Restaurant.

alter table public.inventory_purchase_orders
  add column if not exists status_updated_at timestamptz;

update public.inventory_purchase_orders
set status_updated_at = coalesce(status_updated_at, created_at, timezone('utc', now()))
where status_updated_at is null;

alter table public.inventory_purchase_orders
  alter column status_updated_at set default timezone('utc', now());

alter table public.inventory_purchase_orders
  alter column status_updated_at set not null;

create or replace function public.inventory_purchase_order_set_status(
  p_restaurant_id uuid,
  p_order_id text,
  p_from_status text,
  p_to_status text,
  p_log_entry jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
  v_sort int;
  v_log_id uuid;
  v_line_count int;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  -- Ein Writer pro Restaurant: kein Interleave mit Full-Replace.
  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text)::bigint);

  if p_from_status not in ('open', 'ordered', 'closed')
     or p_to_status not in ('open', 'ordered', 'closed') then
    raise exception 'invalid purchase order status transition % → %', p_from_status, p_to_status
      using errcode = '22023';
  end if;

  if p_from_status is not distinct from p_to_status then
    raise exception 'status unchanged (%)', p_from_status
      using errcode = '22023';
  end if;

  if not (
    (p_from_status = 'open' and p_to_status = 'ordered')
    or (p_from_status = 'ordered' and p_to_status = 'closed')
    or (p_from_status = 'ordered' and p_to_status = 'open')
    or (p_from_status = 'closed' and p_to_status = 'ordered')
  ) then
    raise exception 'invalid purchase order status transition % → %', p_from_status, p_to_status
      using errcode = '22023';
  end if;

  if p_from_status = 'open' and p_to_status = 'ordered' then
    select count(*)::int into v_line_count
    from public.inventory_purchase_order_lines
    where restaurant_id = p_restaurant_id
      and order_id = p_order_id;
    if coalesce(v_line_count, 0) = 0 then
      raise exception 'purchase order % has no lines', p_order_id
        using errcode = '22023';
    end if;
  end if;

  if p_to_status = 'open' then
    if exists (
      select 1
      from public.inventory_purchase_orders cur
      join public.inventory_purchase_orders other
        on other.restaurant_id = cur.restaurant_id
       and other.supplier_id = cur.supplier_id
       and other.id <> cur.id
       and other.status = 'open'
      where cur.restaurant_id = p_restaurant_id
        and cur.id = p_order_id
    ) then
      raise exception 'supplier already has an open purchase order'
        using errcode = '23505';
    end if;
  end if;

  update public.inventory_purchase_orders
  set
    status = p_to_status,
    status_updated_at = timezone('utc', now())
  where restaurant_id = p_restaurant_id
    and id = p_order_id
    and status = p_from_status;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'purchase order % not found or status is not %', p_order_id, p_from_status
      using errcode = 'P0002';
  end if;

  select coalesce(max(sort_order), -1) + 1
  into v_sort
  from public.inventory_purchase_order_log_entries
  where restaurant_id = p_restaurant_id
    and order_id = p_order_id;

  v_log_id := null;
  begin
    if nullif(trim(p_log_entry->>'id'), '') is not null then
      v_log_id := (p_log_entry->>'id')::uuid;
    end if;
  exception
    when invalid_text_representation then
      v_log_id := null;
  end;

  if v_log_id is null then
    insert into public.inventory_purchase_order_log_entries (
      restaurant_id, order_id, sort_order, entry
    ) values (
      p_restaurant_id, p_order_id, v_sort, coalesce(p_log_entry, '{}'::jsonb)
    );
  else
    insert into public.inventory_purchase_order_log_entries (
      id, restaurant_id, order_id, sort_order, entry
    ) values (
      v_log_id, p_restaurant_id, p_order_id, v_sort, coalesce(p_log_entry, '{}'::jsonb)
    )
    on conflict (id) do update
      set
        restaurant_id = excluded.restaurant_id,
        order_id = excluded.order_id,
        sort_order = excluded.sort_order,
        entry = excluded.entry;
  end if;
end;
$$;

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

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text, 0));

  create temporary table if not exists _gwada_po_prev_status (
    id text primary key,
    status text not null,
    status_updated_at timestamptz not null
  ) on commit drop;

  delete from _gwada_po_prev_status;

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

    -- Neuerer DB-Status (z. B. paralleles set_status) gewinnt gegen stale Client.
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
