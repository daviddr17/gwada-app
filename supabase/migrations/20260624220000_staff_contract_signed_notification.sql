-- Benachrichtigung: neuer/unterschriebener Arbeitsvertrag für Mitarbeiter

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
      'staff_shift_start',
      'staff_shift_end',
      'inventory_low_stock',
      'accounting_quotation',
      'accounting_invoice',
      'accounting_voucher',
      'staff_todo_completed',
      'staff_todo_deferred',
      'staff_contract_signed'
    )
  );

create table if not exists public.restaurant_staff_contract_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  contract_id uuid not null references public.restaurant_staff_contracts (id) on delete cascade,
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id, contract_id)
);

create index if not exists restaurant_staff_contract_notification_dismissals_restaurant_idx
  on public.restaurant_staff_contract_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_staff_contract_notification_dismissals enable row level security;

create policy restaurant_staff_contract_notification_dismissals_rw_own
  on public.restaurant_staff_contract_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );
