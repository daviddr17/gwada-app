-- Tägliche und wöchentliche Zusammenfassungen (Vorschau / Rückblick).
-- Standard in den Prefs aus; Versand nur wenn Mail oder WhatsApp je Modul an ist.

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
      'staff_permissions_granted',
      'digest_daily_preview',
      'digest_daily_review',
      'digest_weekly_preview',
      'digest_weekly_review'
    )
  );

create table if not exists public.restaurant_digest_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  event_id uuid not null references public.notification_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, restaurant_id, event_id)
);

alter table public.restaurant_digest_notification_dismissals enable row level security;

create policy restaurant_digest_notification_dismissals_rw_own_staff
  on public.restaurant_digest_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );
