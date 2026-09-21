-- Bestellung „bestellt“ / „abgeschlossen“: Glocke + Mail/WhatsApp (opt-in).
-- Feed „Heute live“ bleibt beim bestehenden Protokoll (inventory_po_activity).

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
      'reservations_activity',
      'events_inquiry',
      'staff_shift_start',
      'staff_shift_end',
      'inventory_low_stock',
      'inventory_po_delivery_due',
      'inventory_po_ordered',
      'inventory_po_closed',
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

create table if not exists public.restaurant_inventory_po_status_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  event_id uuid not null references public.notification_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, restaurant_id, event_id)
);

create index if not exists restaurant_inventory_po_status_dismissals_restaurant_idx
  on public.restaurant_inventory_po_status_dismissals (restaurant_id, profile_id);

alter table public.restaurant_inventory_po_status_dismissals enable row level security;

create policy restaurant_inventory_po_status_dismissals_rw_own_staff
  on public.restaurant_inventory_po_status_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

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

  return new;
end;
$$;

drop trigger if exists trg_inventory_purchase_orders_status_notify
  on public.inventory_purchase_orders;

create trigger trg_inventory_purchase_orders_status_notify
  after update of status on public.inventory_purchase_orders
  for each row
  execute function public.trg_emit_inventory_po_status_notification();

comment on function public.trg_emit_inventory_po_status_notification() is
  'Status ordered/closed (inkl. Auto-Abschluss) → notification_events. Bulk-Replace und Rücksetzen auf offen lösen nichts aus.';
