-- Abschluss einer Bestellung: eine Heute-live-Zeile statt einer Zeile pro Artikel.
-- Protokoll- und Bestandslog bleiben. Nur das Live-Feed-Event der Abschluss-Charge entfällt.
-- Bestand außerhalb einer Bestellung (ohne suppressLiveActivity) bleibt unverändert.

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
  if coalesce(v_entry->>'suppressLiveActivity', '') = 'true' then
    return new;
  end if;

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
  if coalesce(v_entry->>'suppressLiveActivity', '') = 'true' then
    return new;
  end if;

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

create or replace function public.trg_emit_inventory_po_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module text;
  v_stamp timestamptz;
  v_ref text;
  v_lines jsonb;
  v_actor uuid;
  v_staff text;
  v_ordered int;
  v_delivered int;
  v_short int;
  v_missing int;
  v_exceptions jsonb;
  v_feed_ref text;
begin
  -- Full-Replace schreibt historische Status neu — kein Benachrichtigungs-Spam.
  if public.inventory_bulk_replace_active() then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'ordered' then
    v_module := 'inventory_po_ordered';
  elsif new.status = 'closed' then
    v_module := 'inventory_po_closed';
  else
    return new;
  end if;

  v_stamp := coalesce(new.status_updated_at, timezone('utc', clock_timestamp()));
  v_ref := new.id
    || ':'
    || new.status
    || ':'
    || to_char(v_stamp at time zone 'utc', 'YYYYMMDDHH24MISSUS');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ingredientName', l.ingredient_name,
        'articleNumber', nullif(btrim(coalesce(i.article_number, '')), ''),
        'brandLabel', nullif(btrim(coalesce(l.brand_label, '')), ''),
        'quantity', l.quantity,
        'unitLabel', l.unit_label,
        'deliveryStatus', l.delivery_status,
        'deliveredQuantity', l.delivered_quantity,
        'deliveryNote', nullif(btrim(coalesce(l.delivery_note, '')), '')
      )
      order by l.ingredient_name, l.id
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.inventory_purchase_order_lines l
  left join public.inventory_ingredients i
    on i.restaurant_id = l.restaurant_id
   and i.id = l.ingredient_id
  where l.restaurant_id = new.restaurant_id
    and l.order_id = new.id;

  v_actor := auth.uid();
  v_staff := null;
  if v_actor is not null then
    select nullif(btrim(p.display_name), '')
    into v_staff
    from public.profiles p
    where p.id = v_actor;
  end if;

  begin
    insert into public.notification_events (restaurant_id, module, reference_id, payload)
    values (
      new.restaurant_id,
      v_module,
      v_ref,
      jsonb_build_object(
        'orderId', new.id,
        'supplierName', coalesce(nullif(btrim(new.supplier_name), ''), 'Lieferant'),
        'deliveryDate', new.delivery_date,
        'status', new.status,
        'actorProfileId', v_actor,
        'staffName', v_staff,
        'lineCount', jsonb_array_length(v_lines),
        'lines', v_lines,
        'href', '/dashboard/inventory/bestellung'
      )
    );
  exception
    when unique_violation then
      null;
  end;

  -- Heute live: eine Zeile für die ganze Bestellung. Push bleibt bei inventory_po_closed.
  if new.status = 'closed' then
    select
      count(*)::int,
      count(*) filter (
        where l.delivery_status = 'delivered'
           or (l.delivery_status is null and l.delivered_at is not null)
      )::int,
      count(*) filter (where l.delivery_status = 'partial')::int,
      count(*) filter (where l.delivery_status = 'not_delivered')::int,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'ingredientName', l.ingredient_name,
            'status', l.delivery_status,
            'orderedQuantity', l.quantity,
            'deliveredQuantity', coalesce(l.delivered_quantity, 0),
            'unitLabel', coalesce(l.unit_label, ''),
            'note', nullif(btrim(coalesce(l.delivery_note, '')), '')
          )
          order by l.ingredient_name, l.id
        ) filter (where l.delivery_status in ('partial', 'not_delivered')),
        '[]'::jsonb
      )
    into v_ordered, v_delivered, v_short, v_missing, v_exceptions
    from public.inventory_purchase_order_lines l
    where l.restaurant_id = new.restaurant_id
      and l.order_id = new.id;

    v_feed_ref := 'order-completed:'
      || new.id
      || ':'
      || to_char(v_stamp at time zone 'utc', 'YYYYMMDDHH24MISSUS');

    begin
      insert into public.notification_events (
        restaurant_id, module, reference_id, payload, processed_at
      )
      values (
        new.restaurant_id,
        'inventory_po_activity',
        v_feed_ref,
        jsonb_build_object(
          'kind', 'order_completed',
          'orderId', new.id,
          'supplierName', coalesce(nullif(btrim(new.supplier_name), ''), ''),
          'staffName', v_staff,
          'orderedCount', coalesce(v_ordered, 0),
          'deliveredCount', coalesce(v_delivered, 0),
          'shortCount', coalesce(v_short, 0),
          'missingCount', coalesce(v_missing, 0),
          'exceptions', coalesce(v_exceptions, '[]'::jsonb)
        ),
        timezone('utc', now())
      );
    exception
      when unique_violation then
        null;
    end;
  end if;

  return new;
end;
$$;

comment on function public.trg_emit_inventory_po_status_notification() is
  'Status ordered/closed → Glocke. Bei closed zusätzlich eine Heute-live-Zeile (order_completed), ohne Push.';
