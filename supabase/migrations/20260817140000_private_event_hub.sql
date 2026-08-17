-- Private Veranstaltungen: Rechnung am Vorgang, Events-RLS, Notifications, Embed-Theme.

-- ── invoice_id (analog quotation_id) ────────────────────────────────────────

alter table public.reservations
  add column if not exists invoice_id uuid
    references public.accounting_invoices (id) on delete set null;

comment on column public.reservations.invoice_id is
  'Optional verknüpfte Rechnung (Buchführung) — vor allem für kind = private_event.';

create index if not exists reservations_invoice_id_idx
  on public.reservations (invoice_id)
  where invoice_id is not null;

create unique index if not exists reservations_invoice_id_unique
  on public.reservations (invoice_id)
  where invoice_id is not null;

-- ── Events-Staff darf private_event-Zeilen lesen/schreiben ──────────────────

create or replace function public.auth_can_staff_private_event(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.auth_has_restaurant_permission(p_restaurant_id, 'reservations.manage')
    or public.auth_has_restaurant_permission(p_restaurant_id, 'events.manage')
    or public.auth_has_restaurant_permission(p_restaurant_id, 'events.create')
    or public.auth_has_restaurant_permission(p_restaurant_id, 'events.update')
    or public.auth_has_restaurant_permission(p_restaurant_id, 'events.delete');
$$;

create or replace function public.auth_can_read_private_event(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.auth_can_staff_private_event(p_restaurant_id)
    or public.auth_has_restaurant_permission(p_restaurant_id, 'events.read')
    or public.auth_has_restaurant_permission(p_restaurant_id, 'reservations.read');
$$;

comment on function public.auth_can_staff_private_event(uuid) is
  'Staff darf private Veranstaltungen anlegen/ändern (Events oder Reservierungen).';

drop policy if exists "reservations_select_guest_or_staff" on public.reservations;
create policy "reservations_select_guest_or_staff"
  on public.reservations for select
  to authenticated
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or (
      kind = 'private_event'
      and public.auth_can_read_private_event(restaurant_id)
    )
  );

drop policy if exists "reservations_insert_guest_or_staff" on public.reservations;
create policy "reservations_insert_guest_or_staff"
  on public.reservations for insert
  to authenticated
  with check (
    guest_profile_id is null
    or guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or (
      kind = 'private_event'
      and public.auth_can_staff_private_event(restaurant_id)
    )
  );

drop policy if exists "reservations_update_staff_or_guest" on public.reservations;
create policy "reservations_update_staff_or_guest"
  on public.reservations for update
  to authenticated
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or (
      kind = 'private_event'
      and public.auth_can_staff_private_event(restaurant_id)
    )
  )
  with check (
    guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or (
      kind = 'private_event'
      and public.auth_can_staff_private_event(restaurant_id)
    )
  );

drop policy if exists "reservations_delete_staff_or_guest" on public.reservations;
create policy "reservations_delete_staff_or_guest"
  on public.reservations for delete
  to authenticated
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or (
      kind = 'private_event'
      and public.auth_can_staff_private_event(restaurant_id)
    )
  );

drop policy if exists reservation_staff_assignees_select on public.reservation_staff_assignees;
create policy reservation_staff_assignees_select
  on public.reservation_staff_assignees for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and (
          public.auth_has_restaurant_permission(r.restaurant_id, 'reservations.read')
          or public.auth_has_restaurant_permission(r.restaurant_id, 'reservations.manage')
          or (
            r.kind = 'private_event'
            and public.auth_can_read_private_event(r.restaurant_id)
          )
        )
    )
  );

drop policy if exists reservation_staff_assignees_insert on public.reservation_staff_assignees;
create policy reservation_staff_assignees_insert
  on public.reservation_staff_assignees for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and (
          public.auth_has_restaurant_permission(r.restaurant_id, 'reservations.manage')
          or (
            r.kind = 'private_event'
            and public.auth_can_staff_private_event(r.restaurant_id)
          )
        )
    )
    and exists (
      select 1
      from public.reservations r
      join public.restaurant_staff s on s.id = staff_id
      where r.id = reservation_id
        and s.restaurant_id = r.restaurant_id
    )
  );

drop policy if exists reservation_staff_assignees_delete on public.reservation_staff_assignees;
create policy reservation_staff_assignees_delete
  on public.reservation_staff_assignees for delete
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and (
          public.auth_has_restaurant_permission(r.restaurant_id, 'reservations.manage')
          or (
            r.kind = 'private_event'
            and public.auth_can_staff_private_event(r.restaurant_id)
          )
        )
    )
  );

drop policy if exists restaurant_reservation_log_select on public.restaurant_reservation_log_entries;
create policy restaurant_reservation_log_select
  on public.restaurant_reservation_log_entries for select
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or public.auth_has_restaurant_permission(restaurant_id, 'events.manage')
    or public.auth_has_restaurant_permission(restaurant_id, 'events.read')
  );

drop policy if exists restaurant_reservation_log_insert on public.restaurant_reservation_log_entries;
create policy restaurant_reservation_log_insert
  on public.restaurant_reservation_log_entries for insert
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or public.auth_can_staff_private_event(restaurant_id)
    or auth.role() = 'service_role'
  );

-- ── Notifications: Anfragen landen unter Events ─────────────────────────────

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

alter table public.restaurant_reservation_notification_dismissals
  drop constraint if exists restaurant_reservation_notification_dismissals_module_check;

alter table public.restaurant_reservation_notification_dismissals
  add constraint restaurant_reservation_notification_dismissals_module_check
  check (
    module in (
      'reservations_pending',
      'reservations_change_request',
      'reservations_cancellation',
      'events_inquiry'
    )
  );

create or replace function public.trg_emit_notification_event_reservation_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_code text;
  event_module text;
begin
  select rs.code into status_code
  from public.reservation_statuses rs
  where rs.id = new.status_id;

  if status_code is distinct from 'pending' then
    return new;
  end if;

  event_module := case
    when new.kind = 'private_event' then 'events_inquiry'
    else 'reservations_pending'
  end;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    event_module,
    new.id::text,
    jsonb_build_object(
      'guestLabel', trim(concat_ws(' ', new.guest_first_name, new.guest_last_name)),
      'partySize', new.party_size,
      'startsAt', new.starts_at,
      'reservationNumber', new.reservation_number,
      'kind', new.kind,
      'guestCompany', new.guest_company
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = event_module
      and e.reference_id = new.id::text
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

-- ── Embed-Appearance: Anfrage-Widget ────────────────────────────────────────

alter table public.restaurant_embed_appearance
  drop constraint if exists restaurant_embed_appearance_widget_check;

alter table public.restaurant_embed_appearance
  add constraint restaurant_embed_appearance_widget_check check (
    widget in (
      'opening_hours',
      'menu',
      'reviews',
      'news',
      'events',
      'reservation',
      'gallery',
      'event_inquiry'
    )
  );
