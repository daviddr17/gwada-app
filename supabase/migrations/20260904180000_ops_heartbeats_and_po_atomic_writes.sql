-- Ops: Cron-Heartbeat + Alert-Dedupe.
-- Bestand: Lieferung+Lager eine Transaktion; Menge/Lieferdatum inkrementell.

create table if not exists public.platform_cron_heartbeats (
  job_name text primary key,
  last_ok_at timestamptz,
  last_error text,
  last_payload jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_alert_state (
  alert_key text primary key,
  last_sent_at timestamptz,
  last_fingerprint text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_cron_heartbeats enable row level security;
alter table public.platform_alert_state enable row level security;

create or replace function public.record_cron_heartbeat(
  p_job_name text,
  p_ok boolean,
  p_payload jsonb default '{}'::jsonb,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.platform_cron_heartbeats (
    job_name, last_ok_at, last_error, last_payload, updated_at
  ) values (
    p_job_name,
    case when p_ok then timezone('utc', now()) else null end,
    case when p_ok then null else left(coalesce(p_error, 'error'), 240) end,
    coalesce(p_payload, '{}'::jsonb),
    timezone('utc', now())
  )
  on conflict (job_name) do update
    set
      last_ok_at = case
        when p_ok then timezone('utc', now())
        else public.platform_cron_heartbeats.last_ok_at
      end,
      last_error = case
        when p_ok then null
        else left(coalesce(p_error, 'error'), 240)
      end,
      last_payload = excluded.last_payload,
      updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.record_cron_heartbeat(text, boolean, jsonb, text) from public;
grant execute on function public.record_cron_heartbeat(text, boolean, jsonb, text) to service_role;

create or replace function public.inventory_po_line_stock_qty(
  p_status text,
  p_delivered_quantity numeric,
  p_quantity numeric,
  p_delivered_at timestamptz
)
returns numeric
language sql
immutable
as $$
  select case
    when p_status = 'delivered' then
      greatest(0, coalesce(p_delivered_quantity, p_quantity, 0))
    when p_status = 'partial' then
      greatest(0, coalesce(p_delivered_quantity, 0))
    when p_status = 'not_delivered' then 0
    when p_delivered_at is not null then greatest(0, coalesce(p_quantity, 0))
    else 0
  end;
$$;

create or replace function public.inventory_purchase_order_apply_line_delivery_stock(
  p_restaurant_id uuid,
  p_order_id text,
  p_line_id text,
  p_mode text,
  p_delivery_status text,
  p_delivered_quantity numeric,
  p_delivery_note text,
  p_po_log jsonb,
  p_stock_log jsonb,
  p_apply_stock boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_ingredient_id text;
  v_qty numeric;
  v_prev_stock numeric;
  v_next_stock numeric;
  v_delta numeric;
  v_ing_stock numeric;
  v_stock_after numeric;
  v_sort int;
  v_seq int;
  v_log_id uuid;
  v_unresolved int;
  v_auto_closed boolean := false;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text)::bigint);

  if p_mode not in ('set', 'clear') then
    raise exception 'invalid delivery mode %', p_mode using errcode = '22023';
  end if;

  select o.status, l.ingredient_id, l.quantity,
         public.inventory_po_line_stock_qty(
           l.delivery_status, l.delivered_quantity, l.quantity, l.delivered_at
         )
  into v_status, v_ingredient_id, v_qty, v_prev_stock
  from public.inventory_purchase_order_lines l
  join public.inventory_purchase_orders o
    on o.restaurant_id = l.restaurant_id and o.id = l.order_id
  where l.restaurant_id = p_restaurant_id
    and l.order_id = p_order_id
    and l.id = p_line_id;

  if v_ingredient_id is null then
    raise exception 'purchase order line % not found', p_line_id
      using errcode = 'P0002';
  end if;

  if v_status not in ('ordered', 'closed') then
    raise exception 'delivery only on ordered or closed orders'
      using errcode = '22023';
  end if;

  if p_mode = 'clear' then
    update public.inventory_purchase_order_lines
    set
      delivered_at = null,
      delivery_status = null,
      delivered_quantity = null,
      delivery_note = null
    where restaurant_id = p_restaurant_id
      and order_id = p_order_id
      and id = p_line_id;
    v_next_stock := 0;
  else
    if p_delivery_status not in ('delivered', 'not_delivered', 'partial') then
      raise exception 'invalid delivery status %', p_delivery_status
        using errcode = '22023';
    end if;
    v_next_stock := public.inventory_po_line_stock_qty(
      p_delivery_status, p_delivered_quantity, v_qty, timezone('utc', now())
    );
    update public.inventory_purchase_order_lines
    set
      delivered_at = timezone('utc', now()),
      delivery_status = p_delivery_status,
      delivered_quantity = p_delivered_quantity,
      delivery_note = nullif(btrim(coalesce(p_delivery_note, '')), '')
    where restaurant_id = p_restaurant_id
      and order_id = p_order_id
      and id = p_line_id;
  end if;

  v_delta := v_next_stock - coalesce(v_prev_stock, 0);

  select coalesce(max(sort_order), -1) + 1
  into v_sort
  from public.inventory_purchase_order_log_entries
  where restaurant_id = p_restaurant_id and order_id = p_order_id;

  v_log_id := null;
  begin
    if nullif(trim(p_po_log->>'id'), '') is not null then
      v_log_id := (p_po_log->>'id')::uuid;
    end if;
  exception
    when invalid_text_representation then
      v_log_id := null;
  end;

  if v_log_id is null then
    insert into public.inventory_purchase_order_log_entries (
      restaurant_id, order_id, sort_order, entry
    ) values (
      p_restaurant_id, p_order_id, v_sort, coalesce(p_po_log, '{}'::jsonb)
    );
  else
    insert into public.inventory_purchase_order_log_entries (
      id, restaurant_id, order_id, sort_order, entry
    ) values (
      v_log_id, p_restaurant_id, p_order_id, v_sort, coalesce(p_po_log, '{}'::jsonb)
    )
    on conflict (id) do update
      set entry = excluded.entry, sort_order = excluded.sort_order;
  end if;

  v_stock_after := null;
  if not coalesce(p_apply_stock, true) then
    v_delta := 0;
  end if;

  if v_delta <> 0 then
    select current_stock into v_ing_stock
    from public.inventory_ingredients
    where restaurant_id = p_restaurant_id and id = v_ingredient_id
    for update;

    if not found then
      raise exception 'ingredient % not found', v_ingredient_id
        using errcode = 'P0002';
    end if;
    v_ing_stock := coalesce(v_ing_stock, 0);
    if v_ing_stock + v_delta < 0 then
      raise exception 'insufficient stock'
        using errcode = '22023';
    end if;

    update public.inventory_ingredients
    set current_stock = current_stock + v_delta
    where restaurant_id = p_restaurant_id and id = v_ingredient_id
    returning current_stock into v_stock_after;

    select coalesce(max(seq), -1) + 1
    into v_seq
    from public.inventory_stock_log_entries
    where restaurant_id = p_restaurant_id and ingredient_id = v_ingredient_id;

    insert into public.inventory_stock_log_entries (
      restaurant_id, ingredient_id, seq, entry
    ) values (
      p_restaurant_id, v_ingredient_id, v_seq, coalesce(p_stock_log, '{}'::jsonb)
    );
  else
    select current_stock into v_stock_after
    from public.inventory_ingredients
    where restaurant_id = p_restaurant_id and id = v_ingredient_id;
  end if;

  if p_mode = 'set' and v_status = 'ordered' then
    select count(*)::int into v_unresolved
    from public.inventory_purchase_order_lines
    where restaurant_id = p_restaurant_id
      and order_id = p_order_id
      and delivery_status is null
      and delivered_at is null;
    if coalesce(v_unresolved, 0) = 0 then
      update public.inventory_purchase_orders
      set status = 'closed', status_updated_at = timezone('utc', now())
      where restaurant_id = p_restaurant_id
        and id = p_order_id
        and status = 'ordered';
      if found then
        v_auto_closed := true;
      end if;
    end if;
  end if;

  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);

  return jsonb_build_object(
    'stock_delta', v_delta,
    'stock_after', v_stock_after,
    'auto_closed', v_auto_closed
  );
end;
$$;

grant execute on function public.inventory_purchase_order_apply_line_delivery_stock(
  uuid, text, text, text, text, numeric, text, jsonb, jsonb, boolean
) to anon, authenticated, service_role;

create or replace function public.inventory_purchase_order_line_set_quantity(
  p_restaurant_id uuid,
  p_order_id text,
  p_line_id text,
  p_quantity numeric,
  p_log_entry jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_left int;
  v_sort int;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text)::bigint);

  if p_quantity is null or p_quantity < 0 then
    raise exception 'invalid quantity' using errcode = '22023';
  end if;

  select status into v_status
  from public.inventory_purchase_orders
  where restaurant_id = p_restaurant_id and id = p_order_id;

  if v_status is distinct from 'open' then
    raise exception 'quantity only on open orders' using errcode = '22023';
  end if;

  if p_quantity = 0 then
    delete from public.inventory_purchase_order_lines
    where restaurant_id = p_restaurant_id
      and order_id = p_order_id
      and id = p_line_id;
    if not found then
      raise exception 'line % not found', p_line_id using errcode = 'P0002';
    end if;
  else
    update public.inventory_purchase_order_lines
    set quantity = p_quantity
    where restaurant_id = p_restaurant_id
      and order_id = p_order_id
      and id = p_line_id;
    if not found then
      raise exception 'line % not found', p_line_id using errcode = 'P0002';
    end if;
  end if;

  select coalesce(max(sort_order), -1) + 1
  into v_sort
  from public.inventory_purchase_order_log_entries
  where restaurant_id = p_restaurant_id and order_id = p_order_id;

  insert into public.inventory_purchase_order_log_entries (
    restaurant_id, order_id, sort_order, entry
  ) values (
    p_restaurant_id, p_order_id, v_sort, coalesce(p_log_entry, '{}'::jsonb)
  );

  select count(*)::int into v_left
  from public.inventory_purchase_order_lines
  where restaurant_id = p_restaurant_id and order_id = p_order_id;

  if coalesce(v_left, 0) = 0 then
    perform public.inventory_purchase_order_delete_empty_open(
      p_restaurant_id, p_order_id
    );
    perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
    return jsonb_build_object('deleted', true);
  end if;

  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
  return jsonb_build_object('deleted', false, 'quantity', p_quantity);
end;
$$;

grant execute on function public.inventory_purchase_order_line_set_quantity(
  uuid, text, text, numeric, jsonb
) to anon, authenticated, service_role;

create or replace function public.inventory_purchase_order_set_delivery_date(
  p_restaurant_id uuid,
  p_order_id text,
  p_delivery_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text)::bigint);

  update public.inventory_purchase_orders
  set delivery_date = p_delivery_date
  where restaurant_id = p_restaurant_id and id = p_order_id;

  if not found then
    raise exception 'purchase order % not found', p_order_id
      using errcode = 'P0002';
  end if;

  perform public.bump_restaurant_inventory_live_signal_once(p_restaurant_id);
end;
$$;

grant execute on function public.inventory_purchase_order_set_delivery_date(uuid, text, date)
  to anon, authenticated, service_role;

create table if not exists public.platform_live_sync_probes (
  probe_key text primary key,
  revision int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_live_sync_probes enable row level security;

create or replace function public.platform_live_sync_probe_touch(
  p_probe_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.platform_live_sync_probes%rowtype;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.platform_live_sync_probes (probe_key)
  values (p_probe_key)
  on conflict (probe_key) do nothing;

  select * into v_row
  from public.platform_live_sync_probes
  where probe_key = p_probe_key;

  return jsonb_build_object(
    'ok', true,
    'revision', v_row.revision,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.platform_live_sync_probe_cas(
  p_probe_key text,
  p_expected_updated_at timestamptz,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision int;
  v_updated timestamptz;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.platform_live_sync_probes
  set
    revision = revision + 1,
    payload = coalesce(p_payload, '{}'::jsonb),
    updated_at = timezone('utc', now())
  where probe_key = p_probe_key
    and updated_at = p_expected_updated_at
  returning revision, updated_at into v_revision, v_updated;

  if not found then
    return jsonb_build_object('ok', false, 'conflict', true);
  end if;

  return jsonb_build_object(
    'ok', true,
    'conflict', false,
    'revision', v_revision,
    'updated_at', v_updated
  );
end;
$$;

revoke all on function public.platform_live_sync_probe_touch(text) from public;
revoke all on function public.platform_live_sync_probe_cas(text, timestamptz, jsonb) from public;
grant execute on function public.platform_live_sync_probe_touch(text) to service_role;
grant execute on function public.platform_live_sync_probe_cas(text, timestamptz, jsonb) to service_role;
