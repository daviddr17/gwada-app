-- Automatische Antworten (pro Plattform + Sterne) und Sichtbarkeit auf Profil/Embed.

create table public.restaurant_review_auto_reply_rules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null,
  rating smallint not null,
  enabled boolean not null default false,
  reply_template text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_review_auto_reply_rules_platform_check check (
    platform in ('gwada', 'google', 'facebook')
  ),
  constraint restaurant_review_auto_reply_rules_rating_check check (
    rating between 1 and 5
  ),
  constraint restaurant_review_auto_reply_rules_unique unique (
    restaurant_id,
    platform,
    rating
  )
);

create index restaurant_review_auto_reply_rules_restaurant_idx
  on public.restaurant_review_auto_reply_rules (restaurant_id);

create trigger restaurant_review_auto_reply_rules_set_updated_at
  before update on public.restaurant_review_auto_reply_rules
  for each row execute function public.set_updated_at();

alter table public.restaurant_review_auto_reply_rules enable row level security;

create policy restaurant_review_auto_reply_rules_staff_select
  on public.restaurant_review_auto_reply_rules for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_review_auto_reply_rules_staff_write
  on public.restaurant_review_auto_reply_rules for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- Ausgeblendete Bewertungen (Profil + Embed).
create table public.restaurant_review_visibility (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null,
  external_id text not null,
  hidden_at timestamptz not null default timezone('utc', now()),
  hidden_by uuid references public.profiles (id) on delete set null,
  constraint restaurant_review_visibility_platform_check check (
    platform in ('gwada', 'google', 'facebook')
  ),
  primary key (restaurant_id, platform, external_id)
);

create index restaurant_review_visibility_restaurant_idx
  on public.restaurant_review_visibility (restaurant_id);

alter table public.restaurant_review_visibility enable row level security;

create policy restaurant_review_visibility_staff_select
  on public.restaurant_review_visibility for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_review_visibility_staff_write
  on public.restaurant_review_visibility for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- Protokoll: bereits automatisch beantwortet (kein Doppel-Reply bei Sync).
create table public.restaurant_review_auto_reply_log (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null,
  external_id text not null,
  replied_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_review_auto_reply_log_platform_check check (
    platform in ('gwada', 'google', 'facebook')
  ),
  primary key (restaurant_id, platform, external_id)
);

alter table public.restaurant_review_auto_reply_log enable row level security;

create policy restaurant_review_auto_reply_log_staff_select
  on public.restaurant_review_auto_reply_log for select
  using (public.auth_is_restaurant_staff(restaurant_id));
