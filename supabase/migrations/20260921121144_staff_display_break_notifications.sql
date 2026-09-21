-- Display-Pause gestartet / beendet: Glocke + Push (Standard aus).
-- Live: DROP CONSTRAINT IF EXISTS hat die bestehende Check-Zeile übersprungen
-- (relchecks passt nicht), ADD ist danach an dem Namen gescheitert.
-- Hier per Name droppen; nur wenn die Zeile für DROP unsichtbar ist, den
-- kaputten Katalogeintrag entfernen. Keine Zeilen in notification_events.

do $$
declare
  r record;
begin
  raise notice 'pg % notification_events oid=% kind=% relchecks=%',
    current_setting('server_version'),
    'public.notification_events'::regclass,
    (select relkind from pg_class where oid = 'public.notification_events'::regclass),
    (select relchecks from pg_class where oid = 'public.notification_events'::regclass);

  for r in
    select c.oid as relid, n.nspname, c.relname, c.relkind,
           k.oid as coid, k.conname, k.contype, k.conbin is null as bin_null
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_constraint k on k.conrelid = c.oid
    where c.oid = 'public.notification_events'::regclass
       or c.oid in (
         select inhrelid from pg_inherits
         where inhparent = 'public.notification_events'::regclass
       )
       or k.conname = 'notification_events_module_check'
  loop
    raise notice 'rel %.% oid=% kind=% con=% type=% coid=% bin_null=%',
      r.nspname, r.relname, r.relid, r.relkind, r.conname, r.contype, r.coid, r.bin_null;
  end loop;

  for r in
    select n.nspname, c.relname, c.oid as relid, k.oid as coid, k.conname
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where k.conname = 'notification_events_module_check'
  loop
    begin
      execute format('alter table %I.%I drop constraint %I', r.nspname, r.relname, r.conname);
      raise notice 'dropped %.%', r.nspname, r.relname;
    exception
      when undefined_object then
        raise notice 'catalog-delete %.% constraint %', r.nspname, r.relname, r.coid;
        delete from pg_depend
        where (classid = 'pg_constraint'::regclass and objid = r.coid)
           or (refclassid = 'pg_constraint'::regclass and refobjid = r.coid);
        delete from pg_constraint where oid = r.coid;
        update pg_class
        set relchecks = (
          select count(*)::integer
          from pg_constraint k2
          where k2.conrelid = pg_class.oid
            and k2.contype = 'c'
            and k2.conbin is not null
        )
        where oid = r.relid;
    end;
  end loop;

  -- relchecks kann höher sein als die ladbaren CHECK-Zeilen (Warnung
  -- "pg_constraint record(s) missing"). Nur angleichen, wenn es keine
  -- PG18-NOT-NULL-Katalogzeilen gibt.
  update pg_class c
  set relchecks = (
    select count(*)::integer
    from pg_constraint k
    where k.conrelid = c.oid
      and k.contype = 'c'
      and k.conbin is not null
  )
  where (
    c.oid = 'public.notification_events'::regclass
    or c.oid in (
      select inhrelid from pg_inherits
      where inhparent = 'public.notification_events'::regclass
    )
  )
  and not exists (
    select 1 from pg_constraint k
    where k.conrelid = c.oid
      and k.contype = 'n'
  )
  and c.relchecks is distinct from (
    select count(*)::integer
    from pg_constraint k
    where k.conrelid = c.oid
      and k.contype = 'c'
      and k.conbin is not null
  );
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
