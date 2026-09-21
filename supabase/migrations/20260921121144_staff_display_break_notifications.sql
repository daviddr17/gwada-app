-- Display-Pause gestartet / beendet: Glocke + Push (Standard aus).

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
      'staff_display_break_start',
      'staff_display_break_end',
      'staff_permissions_granted',
      'digest_daily_preview',
      'digest_daily_review',
      'digest_weekly_preview',
      'digest_weekly_review'
    )
  );

do $$
declare
  cname text;
begin
  select c.conname into cname
  from pg_constraint c
  where c.conrelid = 'public.restaurant_staff_display_clock_notification_dismissals'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%staff_display_clock_in%';
  if cname is not null then
    execute format(
      'alter table public.restaurant_staff_display_clock_notification_dismissals drop constraint %I',
      cname
    );
  end if;
end $$;

alter table public.restaurant_staff_display_clock_notification_dismissals
  add constraint staff_display_clock_dismissals_module_check
  check (
    module in (
      'staff_display_clock_in',
      'staff_display_clock_out',
      'staff_display_break_start',
      'staff_display_break_end'
    )
  );
