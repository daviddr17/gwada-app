-- Gast-Chat: rotierende Login-Codes (48h) + Sessions (Cookie), ohne PIN in der URL.

create table public.contact_guest_login_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  consumed_at timestamptz,
  constraint contact_guest_login_codes_code_hash_len check (char_length(code_hash) <= 200)
);

create index contact_guest_login_codes_contact_active_idx
  on public.contact_guest_login_codes (contact_id, expires_at desc)
  where consumed_at is null;

create index contact_guest_login_codes_restaurant_idx
  on public.contact_guest_login_codes (restaurant_id);

alter table public.contact_guest_login_codes enable row level security;

create policy "contact_guest_login_codes_staff_select"
  on public.contact_guest_login_codes for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create table public.contact_guest_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create index contact_guest_sessions_contact_active_idx
  on public.contact_guest_sessions (contact_id)
  where revoked_at is null;

alter table public.contact_guest_sessions enable row level security;

create policy "contact_guest_sessions_staff_select"
  on public.contact_guest_sessions for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create table public.contact_guest_auth_attempts (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  ip_hash text not null,
  success boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index contact_guest_auth_attempts_contact_created_idx
  on public.contact_guest_auth_attempts (contact_id, created_at desc);

alter table public.contact_guest_auth_attempts enable row level security;

alter table public.restaurant_contact_settings
  add column if not exists guest_chat_code_valid_hours integer not null default 48,
  add column if not exists guest_chat_session_hours integer not null default 24;

comment on column public.restaurant_contact_settings.guest_chat_code_valid_hours is
  'Gültigkeit eines Zugangscodes nach Versand (Stunden).';
comment on column public.restaurant_contact_settings.guest_chat_session_hours is
  'Gültigkeit der Gast-Session nach erfolgreichem Code (Stunden).';

alter table public.restaurant_contact_settings
  add constraint restaurant_contact_settings_guest_chat_code_hours_check
    check (guest_chat_code_valid_hours between 1 and 168),
  add constraint restaurant_contact_settings_guest_chat_session_hours_check
    check (guest_chat_session_hours between 1 and 168);

-- URL-Vorlage ohne PIN: {pin} nur noch optional (Text), nicht in URL empfohlen.
comment on column public.restaurant_contact_settings.guest_chat_url_template is
  'Gast-Chat-Link: {id} oder {kontakt}. Kein {pin} in der URL — Code separat.';
