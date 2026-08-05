-- Rechte-Freischaltung (Glocke/Push) + Login-Streak + Unlock-Celebration

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
      'staff_contract_signed',
      'staff_display_time_request',
      'staff_invite_accepted',
      'staff_invite_declined',
      'staff_display_clock_in',
      'staff_display_clock_out',
      'staff_permissions_granted'
    )
  );

create table if not exists public.restaurant_staff_permission_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  unlock_id uuid not null,
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id, unlock_id)
);

create index if not exists restaurant_staff_permission_notification_dismissals_restaurant_idx
  on public.restaurant_staff_permission_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_staff_permission_notification_dismissals enable row level security;

create policy restaurant_staff_permission_notification_dismissals_rw_own
  on public.restaurant_staff_permission_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

-- Pending Unlock-Celebration im Dashboard (erste Session nach neuen Rechten)
create table if not exists public.user_permission_unlocks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  permission_keys text[] not null default '{}',
  permission_labels text[] not null default '{}',
  position_name text,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default timezone('utc', now()),
  seen_at timestamptz
);

create index if not exists user_permission_unlocks_unseen_idx
  on public.user_permission_unlocks (profile_id, restaurant_id)
  where seen_at is null;

create index if not exists user_permission_unlocks_profile_idx
  on public.user_permission_unlocks (profile_id, granted_at desc);

alter table public.user_permission_unlocks enable row level security;

create policy user_permission_unlocks_select_own
  on public.user_permission_unlocks for select
  using (profile_id = (select auth.uid()));

create policy user_permission_unlocks_update_own
  on public.user_permission_unlocks for update
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Login-Tage für Streak (Kalendertag Europe/Berlin)
create table if not exists public.user_login_days (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, day)
);

create index if not exists user_login_days_profile_day_idx
  on public.user_login_days (profile_id, day desc);

alter table public.user_login_days enable row level security;

create policy user_login_days_select_own
  on public.user_login_days for select
  using (profile_id = (select auth.uid()));

-- Heartbeat schreibt auch den Login-Tag (idempotent)
create or replace function public.touch_profile_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  login_day date;
begin
  if uid is null then
    return;
  end if;

  update public.profiles
  set last_seen_at = timezone('utc', now())
  where id = uid;

  login_day := (timezone('Europe/Berlin', now()))::date;
  insert into public.user_login_days (profile_id, day)
  values (uid, login_day)
  on conflict (profile_id, day) do nothing;
end;
$$;

revoke all on function public.touch_profile_last_seen() from public;
grant execute on function public.touch_profile_last_seen() to authenticated;
