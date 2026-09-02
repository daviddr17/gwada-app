-- O(1) Statuswechsel für Bestellungen (kein Full-Replace der gesamten History).
-- Großkunden: „Als bestellt“ / Abschließen / Zurücksetzen darf nicht an statement_timeout scheitern.

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

  if p_from_status not in ('open', 'ordered', 'closed')
     or p_to_status not in ('open', 'ordered', 'closed') then
    raise exception 'invalid purchase order status transition % → %', p_from_status, p_to_status
      using errcode = '22023';
  end if;

  if p_from_status is not distinct from p_to_status then
    raise exception 'status unchanged (%)', p_from_status
      using errcode = '22023';
  end if;

  -- Erlaubte Übergänge (wie Client: open↔ordered↔closed)
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
  set status = p_to_status
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

grant execute on function public.inventory_purchase_order_set_status(uuid, text, text, text, jsonb)
  to anon, authenticated, service_role;

comment on function public.inventory_purchase_order_set_status(uuid, text, text, text, jsonb) is
  'O(1) PO status change + one log row — avoids full restaurant replace timeouts.';
