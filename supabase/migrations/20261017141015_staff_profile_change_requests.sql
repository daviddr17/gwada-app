-- Display: Stammdaten ändern / erstbefüllen → Freigabe im Dashboard

create table if not exists public.restaurant_staff_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  previous_fields jsonb not null default '{}'::jsonb,
  proposed_fields jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  review_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  display_acknowledged_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists restaurant_staff_profile_change_requests_one_pending_per_staff_idx
  on public.restaurant_staff_profile_change_requests (staff_id)
  where status = 'pending';

create index if not exists restaurant_staff_profile_change_requests_restaurant_pending_idx
  on public.restaurant_staff_profile_change_requests (restaurant_id, status, created_at desc);

create index if not exists restaurant_staff_profile_change_requests_staff_resolved_unacked_idx
  on public.restaurant_staff_profile_change_requests (staff_id, status, display_acknowledged_at)
  where status in ('approved', 'declined');

create trigger restaurant_staff_profile_change_requests_set_updated_at
  before update on public.restaurant_staff_profile_change_requests
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_profile_change_requests enable row level security;

create policy restaurant_staff_profile_change_requests_staff_select
  on public.restaurant_staff_profile_change_requests for select
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'staff.read')
    or public.auth_has_restaurant_permission(restaurant_id, 'staff.manage')
  );

create policy restaurant_staff_profile_change_requests_staff_update
  on public.restaurant_staff_profile_change_requests for update
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'staff.update')
    or public.auth_has_restaurant_permission(restaurant_id, 'staff.manage')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'staff.update')
    or public.auth_has_restaurant_permission(restaurant_id, 'staff.manage')
  );

comment on table public.restaurant_staff_profile_change_requests is
  'Display-Anfragen für Stammdaten (Erstbefüllung / Änderung); Freigabe im Mitarbeiter-Dashboard.';

-- Glocke: Modul erweitern (Name module_chk, siehe staff_display_break_notifications)
alter table public.notification_events
  drop constraint if exists notification_events_module_check;

alter table public.notification_events
  drop constraint if exists notification_events_module_chk;

alter table public.notification_events
  add constraint notification_events_module_chk
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
      'staff_profile_change_request',
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

create table if not exists public.restaurant_staff_profile_change_request_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  request_id uuid not null references public.restaurant_staff_profile_change_requests (id) on delete cascade,
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id, request_id)
);

create index if not exists restaurant_staff_profile_change_request_notification_dismissals_restaurant_idx
  on public.restaurant_staff_profile_change_request_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_staff_profile_change_request_notification_dismissals enable row level security;

create policy restaurant_staff_profile_change_request_notification_dismissals_rw_own
  on public.restaurant_staff_profile_change_request_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );
