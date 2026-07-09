-- Kontakt-Tags (VIP, benutzerdefiniert) und einzelne Notizen für die Timeline.

-- ---------------------------------------------------------------------------
-- Tag-Stammdaten pro Restaurant
-- ---------------------------------------------------------------------------
create table public.contact_tags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  slug text,
  name text not null,
  background_color text not null default '#64748b',
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contact_tags_name_len check (char_length(name) <= 64)
);

create unique index contact_tags_restaurant_slug_uniq
  on public.contact_tags (restaurant_id, slug)
  where slug is not null;

create unique index contact_tags_restaurant_name_uniq
  on public.contact_tags (restaurant_id, lower(name));

create index contact_tags_restaurant_sort_idx
  on public.contact_tags (restaurant_id, sort_order, name);

create trigger contact_tags_set_updated_at
  before update on public.contact_tags
  for each row execute function public.set_updated_at();

alter table public.contact_tags enable row level security;

create policy "contact_tags_staff_all"
  on public.contact_tags for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Tag-Zuweisungen
-- ---------------------------------------------------------------------------
create table public.contact_tag_assignments (
  contact_id uuid not null references public.contacts (id) on delete cascade,
  tag_id uuid not null references public.contact_tags (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (contact_id, tag_id)
);

create index contact_tag_assignments_tag_id_idx
  on public.contact_tag_assignments (tag_id);

create index contact_tag_assignments_restaurant_id_idx
  on public.contact_tag_assignments (restaurant_id);

alter table public.contact_tag_assignments enable row level security;

create policy "contact_tag_assignments_staff_all"
  on public.contact_tag_assignments for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Einzelnotizen (Timeline)
-- ---------------------------------------------------------------------------
create table public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users (id) on delete set null,
  constraint contact_notes_body_len check (char_length(body) <= 4000)
);

create index contact_notes_contact_created_idx
  on public.contact_notes (contact_id, created_at desc);

alter table public.contact_notes enable row level security;

create policy "contact_notes_staff_all"
  on public.contact_notes for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- VIP-Systemtag für bestehende Restaurants
insert into public.contact_tags (restaurant_id, slug, name, background_color, sort_order, is_system)
select r.id, 'vip', 'VIP', '#eab308', 0, true
from public.restaurants r
where not exists (
  select 1
  from public.contact_tags t
  where t.restaurant_id = r.id
    and t.slug = 'vip'
);
