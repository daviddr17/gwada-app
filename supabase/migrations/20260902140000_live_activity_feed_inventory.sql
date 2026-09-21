-- „Heute live“: Bestell-Protokoll + Bestands-Log → notification_events (Feed, keine Glocke/Push).

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
      'events_inquiry',
      'staff_shift_start',
      'staff_shift_end',
      'inventory_low_stock',
      'inventory_po_delivery_due',
      'inventory_po_activity',
      'inventory_stock_activity',
      'messages_follow_up',
      'accounting_quotation',
      'accounting_invoice',
      'accounting_voucher',
      'staff_todo_completed',
      'staff_todo_deferred',
      'personal_reminder',
      'staff_messages',
      'staff_contract_signed',
      'staff_document_assigned',
      'staff_display_time_request',
      'staff_invite_accepted',
      'staff_invite_declined',
      'staff_display_clock_in',
      'staff_display_clock_out',
      'staff_permissions_granted'
    )
  );

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

drop trigger if exists inventory_po_log_emit_live_activity on public.inventory_purchase_order_log_entries;
create trigger inventory_po_log_emit_live_activity
  after insert on public.inventory_purchase_order_log_entries
  for each row
  execute function public.trg_emit_notification_event_inventory_po_log();

create or replace function public.trg_emit_notification_event_inventory_stock_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_entry jsonb;
  v_ingredient_name text;
  v_staff_name text;
begin
  v_entry := new.entry;
  v_kind := v_entry->>'kind';

  if v_kind is null then
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

  select ing.name
  into v_ingredient_name
  from public.inventory_ingredients ing
  where ing.restaurant_id = new.restaurant_id
    and ing.id = new.ingredient_id;

  v_staff_name := trim(
    coalesce(v_entry->>'userFirstName', '') || ' ' || coalesce(v_entry->>'userLastName', '')
  );

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  values (
    new.restaurant_id,
    'inventory_stock_activity',
    new.id::text,
    jsonb_build_object(
      'logEntryId', new.id,
      'ingredientId', new.ingredient_id,
      'ingredientName', coalesce(v_ingredient_name, coalesce(v_entry->>'ingredientName', '')),
      'kind', v_kind,
      'fromQuantity', v_entry->'fromQuantity',
      'toQuantity', v_entry->'toQuantity',
      'unitLabel', coalesce(v_entry->>'unitLabel', ''),
      'orderId', coalesce(v_entry->>'orderId', ''),
      'supplierName', coalesce(v_entry->>'supplierName', ''),
      'staffName', v_staff_name,
      'at', coalesce(v_entry->>'at', timezone('utc', now())::text)
    )
  );

  return new;
end;
$$;

drop trigger if exists inventory_stock_log_emit_live_activity on public.inventory_stock_log_entries;
create trigger inventory_stock_log_emit_live_activity
  after insert on public.inventory_stock_log_entries
  for each row
  execute function public.trg_emit_notification_event_inventory_stock_log();
