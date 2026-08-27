-- Fällige Bestell-Lieferungen: Glocke/Push + tägliche Dismissals.

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
      'messages_follow_up',
      'accounting_quotation',
      'accounting_invoice',
      'accounting_voucher',
      'staff_todo_completed',
      'staff_todo_deferred',
      'staff_contract_signed',
      'staff_display_time_request',
      'staff_invite_accepted',
      'staff_invite_declined',
      'staff_display_clock_in',
      'staff_display_clock_out',
      'staff_permissions_granted'
    )
  );

create table if not exists public.restaurant_inventory_po_delivery_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id text not null,
  dismissed_on_ymd date not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, restaurant_id, order_id, dismissed_on_ymd)
);

create index if not exists restaurant_inventory_po_delivery_dismissals_restaurant_idx
  on public.restaurant_inventory_po_delivery_dismissals (restaurant_id, profile_id, dismissed_on_ymd);

alter table public.restaurant_inventory_po_delivery_dismissals enable row level security;

create policy restaurant_inventory_po_delivery_dismissals_rw_own_staff
  on public.restaurant_inventory_po_delivery_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );
