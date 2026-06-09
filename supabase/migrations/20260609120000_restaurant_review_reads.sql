-- Gelesen/Ungelesen pro Nutzer, Restaurant und Bewertung (Gwada + externe IDs).

create table public.restaurant_review_reads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null,
  review_id text not null,
  read_at timestamptz,
  marked_unread_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_review_reads_platform_check check (
    platform in ('gwada', 'google', 'facebook')
  ),
  constraint restaurant_review_reads_unique unique (
    restaurant_id,
    user_id,
    platform,
    review_id
  )
);

create index restaurant_review_reads_user_restaurant_idx
  on public.restaurant_review_reads (restaurant_id, user_id);

alter table public.restaurant_review_reads enable row level security;

create policy restaurant_review_reads_own_staff
  on public.restaurant_review_reads for all
  using (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  );

create trigger restaurant_review_reads_set_updated_at
  before update on public.restaurant_review_reads
  for each row execute function public.set_updated_at();
