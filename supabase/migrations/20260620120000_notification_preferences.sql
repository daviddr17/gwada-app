-- Benachrichtigungen: Präferenzen pro Benutzer/Restaurant + Lesestatus (erweiterbar).

create table public.user_restaurant_notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  channel_whatsapp_enabled boolean not null default false,
  channel_email_enabled boolean not null default true,
  in_app_modules jsonb not null default '{}'::jsonb,
  push_whatsapp_modules jsonb not null default '{}'::jsonb,
  push_email_modules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id),
  constraint user_restaurant_notification_prefs_in_app_object
    check (jsonb_typeof(in_app_modules) = 'object'),
  constraint user_restaurant_notification_prefs_push_wa_object
    check (jsonb_typeof(push_whatsapp_modules) = 'object'),
  constraint user_restaurant_notification_prefs_push_email_object
    check (jsonb_typeof(push_email_modules) = 'object')
);

create index user_restaurant_notification_preferences_restaurant_id_idx
  on public.user_restaurant_notification_preferences (restaurant_id);

create trigger user_restaurant_notification_preferences_set_updated_at
  before update on public.user_restaurant_notification_preferences
  for each row execute function public.set_updated_at();

alter table public.user_restaurant_notification_preferences enable row level security;

create policy "user_restaurant_notification_preferences_rw_own_staff"
  on public.user_restaurant_notification_preferences for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

comment on table public.user_restaurant_notification_preferences is
  'Benachrichtigungskanäle und Modul-Toggles je Profil und Restaurant (JSONB-Keys = notification module id).';

-- Changelog: gelesen pro Benutzer
create table public.platform_changelog_reads (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  changelog_entry_id uuid not null references public.platform_changelog_entries (id) on delete cascade,
  read_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, changelog_entry_id)
);

create index platform_changelog_reads_profile_id_idx
  on public.platform_changelog_reads (profile_id);

alter table public.platform_changelog_reads enable row level security;

create policy "platform_changelog_reads_rw_own"
  on public.platform_changelog_reads for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Reservierungen: aus dem Glocken-Menü weggeklickt (unbestätigt bleibt in Modul)
create table public.restaurant_reservation_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, reservation_id)
);

create index restaurant_reservation_notification_dismissals_restaurant_idx
  on public.restaurant_reservation_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_reservation_notification_dismissals enable row level security;

create policy "restaurant_reservation_notification_dismissals_rw_own_staff"
  on public.restaurant_reservation_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );
