-- Display-Pause gestartet / beendet: Glocke + Push (Standard aus).
-- Live: DROP CONSTRAINT IF EXISTS hat die bestehende Check-Zeile übersprungen
-- (relchecks passt nicht), ADD ist danach an dem Namen gescheitert.
-- Hier per Name droppen; nur wenn die Zeile für DROP unsichtbar ist, den
-- kaputten Katalogeintrag entfernen. Keine Zeilen in notification_events.

do $$
declare
  coid oid;
begin
  select oid into coid
  from pg_constraint
  where conrelid = 'public.notification_events'::regclass
    and conname = 'notification_events_module_check';

  if coid is null then
    raise notice 'notification_events_module_check absent before replace';
  else
    raise notice 'notification_events_module_check oid=% bin_null=% relchecks=%',
      coid,
      (select conbin is null from pg_constraint where oid = coid),
      (select relchecks from pg_class where oid = 'public.notification_events'::regclass);
    begin
      alter table public.notification_events
        drop constraint notification_events_module_check;
    exception
      when undefined_object then
        raise notice 'drop did not see notification_events_module_check; removing catalog row %', coid;
        delete from pg_depend
        where (classid = 'pg_constraint'::regclass and objid = coid)
           or (refclassid = 'pg_constraint'::regclass and refobjid = coid);
        delete from pg_constraint where oid = coid;
        update pg_class
        set relchecks = (
          select count(*)::integer
          from pg_constraint
          where conrelid = pg_class.oid
            and contype = 'c'
        )
        where oid = 'public.notification_events'::regclass;
    end;
  end if;
end $$;

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
  coid oid;
begin
  select c.conname, c.oid into cname, coid
  from pg_constraint c
  where c.conrelid = 'public.restaurant_staff_display_clock_notification_dismissals'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%staff_display_clock_in%';
  if cname is null then
    return;
  end if;
  begin
    execute format(
      'alter table public.restaurant_staff_display_clock_notification_dismissals drop constraint %I',
      cname
    );
  exception
    when undefined_object then
      raise notice 'drop did not see %; removing catalog row %', cname, coid;
      delete from pg_depend
      where (classid = 'pg_constraint'::regclass and objid = coid)
         or (refclassid = 'pg_constraint'::regclass and refobjid = coid);
      delete from pg_constraint where oid = coid;
      update pg_class
      set relchecks = (
        select count(*)::integer
        from pg_constraint
        where conrelid = pg_class.oid
          and contype = 'c'
      )
      where oid = 'public.restaurant_staff_display_clock_notification_dismissals'::regclass;
  end;
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
