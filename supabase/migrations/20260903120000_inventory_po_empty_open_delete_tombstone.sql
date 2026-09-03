-- Absichtliches Löschen offener Bestellungen (letzte Position → 0) darf nicht
-- durch Merge/Full-Replace oder stale Clients wiederbelebt werden.
-- Tombstones + O(1)-Delete; Replace überspringt tombstonierte IDs und
-- markiert aus dem Payload entfernte Prev-Orders.

create table if not exists public.inventory_purchase_order_deletions (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id text not null,
  deleted_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, order_id)
);

create index if not exists inventory_po_deletions_restaurant_deleted_at_idx
  on public.inventory_purchase_order_deletions (restaurant_id, deleted_at desc);

alter table public.inventory_purchase_order_deletions enable row level security;

drop policy if exists "inventory_purchase_order_deletions_access"
  on public.inventory_purchase_order_deletions;
create policy "inventory_purchase_order_deletions_access"
  on public.inventory_purchase_order_deletions for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

-- O(1): offene Bestellung löschen + Tombstone (kein Full-Replace).
create or replace function public.inventory_purchase_order_delete_empty_open(
  p_restaurant_id uuid,
  p_order_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  select status into v_status
  from public.inventory_purchase_orders
  where restaurant_id = p_restaurant_id
    and id = p_order_id;

  if v_status is null then
    -- Bereits weg: Tombstone trotzdem setzen (Idempotenz gegen stale Re-Add).
    insert into public.inventory_purchase_order_deletions (
      restaurant_id, order_id, deleted_at
    ) values (
      p_restaurant_id, p_order_id, timezone('utc', now())
    )
    on conflict (restaurant_id, order_id) do update
      set deleted_at = excluded.deleted_at;
    return;
  end if;

  if v_status is distinct from 'open' then
    raise exception 'purchase order % is not open (status=%)', p_order_id, v_status
      using errcode = '22023';
  end if;

  -- Auch mit Restpositionen ok: Client setzte zuletzt auf 0 (Race mit Merge).
  delete from public.inventory_purchase_orders
  where restaurant_id = p_restaurant_id
    and id = p_order_id
    and status = 'open';

  insert into public.inventory_purchase_order_deletions (
    restaurant_id, order_id, deleted_at
  ) values (
    p_restaurant_id, p_order_id, timezone('utc', now())
  )
  on conflict (restaurant_id, order_id) do update
    set deleted_at = excluded.deleted_at;

  -- Alte Tombstones aufräumen (14 Tage)
  delete from public.inventory_purchase_order_deletions
  where restaurant_id = p_restaurant_id
    and deleted_at < timezone('utc', now()) - interval '14 days';

  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
end;
$$;

grant execute on function public.inventory_purchase_order_delete_empty_open(uuid, text)
  to anon, authenticated, service_role;

comment on function public.inventory_purchase_order_delete_empty_open(uuid, text) is
  'O(1) delete open PO + tombstone so stale full-replace snapshots cannot resurrect it.';

-- Replace: Prev-ohne-Payload → Tombstone; Tombstonierte IDs nicht wieder einfügen.
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
  v_order_id text;
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

  delete from _gwada_po_prev_status where true;

  insert into _gwada_po_prev_status (id, status, status_updated_at)
  select id, status, status_updated_at
  from public.inventory_purchase_orders
  where restaurant_id = p_restaurant_id;

  create temporary table if not exists _gwada_po_incoming_ids (
    id text primary key
  ) on commit drop;

  delete from _gwada_po_incoming_ids where true;

  insert into _gwada_po_incoming_ids (id)
  select distinct nullif(trim(e->>'id'), '')
  from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) e
  where nullif(trim(e->>'id'), '') is not null;

  -- Nur offene Orders, die absichtlich fehlen → Tombstone
  -- (closed/ordered nie tombstonen: Merge soll sie bei stale Clients retten können)
  insert into public.inventory_purchase_order_deletions (restaurant_id, order_id, deleted_at)
  select p_restaurant_id, p.id, timezone('utc', now())
  from _gwada_po_prev_status p
  where p.status = 'open'
    and not exists (
      select 1 from _gwada_po_incoming_ids i where i.id = p.id
    )
  on conflict (restaurant_id, order_id) do update
    set deleted_at = excluded.deleted_at;

  perform set_config('gwada.inventory_bulk_replace', '1', true);

  delete from public.inventory_purchase_order_log_entries where restaurant_id = p_restaurant_id;
  delete from public.inventory_purchase_order_lines where restaurant_id = p_restaurant_id;
  delete from public.inventory_purchase_orders where restaurant_id = p_restaurant_id;

  for ord in select * from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb))
  loop
    v_order_id := nullif(trim(ord->>'id'), '');
    if v_order_id is null then
      continue;
    end if;

    -- Stale Client darf tombstonierte Bestellung nicht wieder einfügen
    if exists (
      select 1
      from public.inventory_purchase_order_deletions d
      where d.restaurant_id = p_restaurant_id
        and d.order_id = v_order_id
    ) then
      continue;
    end if;

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
    where p.id = v_order_id;

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
      v_order_id,
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
        v_order_id,
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
        ) values (p_restaurant_id, v_order_id, s, lg);
      else
        insert into public.inventory_purchase_order_log_entries (
          id, restaurant_id, order_id, sort_order, entry
        ) values (v_log_id, p_restaurant_id, v_order_id, s, lg)
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

  delete from public.inventory_purchase_order_deletions
  where restaurant_id = p_restaurant_id
    and deleted_at < timezone('utc', now()) - interval '14 days';

  perform set_config('gwada.inventory_bulk_replace', '0', true);
  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
end;
$$;
