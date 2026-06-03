-- Gwada-Bewertungen (nur per Einladungslink) + Einstellungen für Bewertungsnachfragen

alter table public.restaurant_reservation_settings
  add column if not exists review_request_enabled boolean not null default false,
  add column if not exists review_request_include_gwada boolean not null default true,
  add column if not exists review_request_include_google boolean not null default false,
  add column if not exists review_request_include_facebook boolean not null default false,
  add column if not exists review_google_url text,
  add column if not exists review_facebook_url text;

comment on column public.restaurant_reservation_settings.review_request_enabled is
  'Nach Besuch (Danke-Nachricht) Bewertungslinks mitsenden.';
comment on column public.restaurant_reservation_settings.review_request_include_gwada is
  'Gwada-Einladungslink in Bewertungsnachfrage.';
comment on column public.restaurant_reservation_settings.review_google_url is
  'Optional: direkter Google-Bewertungslink (sonst aus Integration).';
comment on column public.restaurant_reservation_settings.review_facebook_url is
  'Optional: direkter Facebook-Empfehlungslink.';

create table if not exists public.gwada_review_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  token text not null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gwada_review_invitations_token_unique unique (token),
  constraint gwada_review_invitations_reservation_unique unique (reservation_id)
);

create index if not exists gwada_review_invitations_reservation_idx
  on public.gwada_review_invitations (reservation_id);

create table if not exists public.gwada_reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  invitation_id uuid not null references public.gwada_review_invitations (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  guest_display_name text,
  created_at timestamptz not null default now(),
  constraint gwada_reviews_invitation_unique unique (invitation_id)
);

create index if not exists gwada_reviews_restaurant_created_idx
  on public.gwada_reviews (restaurant_id, created_at desc);

alter table public.gwada_review_invitations enable row level security;
alter table public.gwada_reviews enable row level security;

create policy gwada_review_invitations_staff_select on public.gwada_review_invitations
  for select to authenticated
  using (public.auth_is_restaurant_staff (restaurant_id));

create policy gwada_reviews_staff_select on public.gwada_reviews
  for select to authenticated
  using (public.auth_is_restaurant_staff (restaurant_id));

create policy gwada_reviews_staff_insert on public.gwada_reviews
  for insert to authenticated
  with check (public.auth_is_restaurant_staff (restaurant_id));

grant select on public.gwada_review_invitations to authenticated;
grant select, insert on public.gwada_reviews to authenticated;
