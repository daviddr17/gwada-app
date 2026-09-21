-- „Heute live“: Reservierungs-Protokoll → notification_events (Feed, keine Glocke/Push).
-- Deckt Bestätigen, Staff-Änderungen, Freigaben usw. — parallel zu den bestehenden
-- Alert-Modulen (pending / change_request / cancellation).

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

create or replace function public.trg_emit_notification_event_reservation_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_details jsonb;
  v_actor_source text;
  v_staff_name text;
  v_summary text;
  v_changes jsonb;
  v_change_count int;
  v_status_to text;
begin
  v_details := coalesce(new.details, '{}'::jsonb);
  v_actor_source := coalesce(nullif(trim(v_details->>'actorSource'), ''), 'staff');
  v_changes := coalesce(v_details->'changes', '[]'::jsonb);
  if jsonb_typeof(v_changes) <> 'array' then
    v_changes := '[]'::jsonb;
  end if;
  v_change_count := jsonb_array_length(v_changes);
  v_summary := nullif(trim(coalesce(v_details->>'summary', '')), '');

  -- Bereits als Alert-Module abgedeckt → kein zweiter Feed-Eintrag.
  if new.action = 'change_request_submitted' then
    return new;
  end if;

  if new.action = 'created' and v_actor_source = 'guest' then
    return new;
  end if;

  -- Reines Storno: reservations_cancellation deckt den Feed bereits ab.
  if new.action = 'updated' and v_change_count = 1 then
    select nullif(trim(c->>'to'), '')
    into v_status_to
    from jsonb_array_elements(v_changes) c
    where c->>'field' = 'status'
    limit 1;

    if v_status_to is not null
       and lower(v_status_to) ~ '(storn|cancel|abgesagt)' then
      return new;
    end if;
  end if;

  if exists (
    select 1
    from public.notification_events e
    where e.restaurant_id = new.restaurant_id
      and e.module = 'reservations_activity'
      and e.reference_id = new.id::text
  ) then
    return new;
  end if;

  v_staff_name := trim(
    coalesce(v_details->>'actorGivenName', '') || ' ' ||
    coalesce(v_details->>'actorFamilyName', '')
  );
  if v_staff_name = '' then
    v_staff_name := case
      when v_actor_source = 'guest' then 'Gast'
      when v_actor_source = 'display' then 'Display'
      else ''
    end;
  elsif v_actor_source = 'display' then
    v_staff_name := v_staff_name || ' · Display';
  end if;

  if v_summary is null and v_change_count > 0 then
    select string_agg(
      format(
        '%s: „%s“ → „%s“',
        coalesce(nullif(c->>'label', ''), c->>'field'),
        coalesce(nullif(c->>'from', ''), '—'),
        coalesce(nullif(c->>'to', ''), '—')
      ),
      ' · '
      order by ord
    )
    into v_summary
    from jsonb_array_elements(v_changes) with ordinality as t(c, ord);
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  values (
    new.restaurant_id,
    'reservations_activity',
    new.id::text,
    jsonb_build_object(
      'logEntryId', new.id,
      'reservationId', new.reservation_id,
      'reservationNumber', new.reservation_number,
      'guestLabel', new.guest_label,
      'action', new.action,
      'actorSource', v_actor_source,
      'staffName', v_staff_name,
      'summary', coalesce(v_summary, ''),
      'changes', v_changes,
      'at', coalesce(new.created_at, timezone('utc', now()))::text
    )
  );

  return new;
end;
$$;

drop trigger if exists reservation_log_emit_live_activity
  on public.restaurant_reservation_log_entries;
create trigger reservation_log_emit_live_activity
  after insert on public.restaurant_reservation_log_entries
  for each row
  execute function public.trg_emit_notification_event_reservation_log();

comment on function public.trg_emit_notification_event_reservation_log() is
  'Live-Feed: Bestätigen/Ändern/Freigeben aus restaurant_reservation_log_entries (keine Glocke/Push).';
