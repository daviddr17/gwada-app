-- App-wide JSON snapshots per restaurant (menu, inventory UI, settings, …).
-- RLS: staff of the restaurant, plus open read/write for the published demo slug
-- so local dev works without auth (remove or tighten before production).

create table public.restaurant_app_state (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  storage_key text not null,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, storage_key)
);

create index restaurant_app_state_updated_idx
  on public.restaurant_app_state (restaurant_id, updated_at desc);

create trigger restaurant_app_state_set_updated_at
  before update on public.restaurant_app_state
  for each row execute function public.set_updated_at();

alter table public.restaurant_app_state enable row level security;

-- Staff / owners (any active employee)
create policy "restaurant_app_state_staff_all"
  on public.restaurant_app_state for all
  using (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurant_app_state.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_employees re
      where re.restaurant_id = restaurant_app_state.restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
    )
  );

-- Local / staging: anonymous sync for the seeded demo restaurant only
create policy "restaurant_app_state_demo_anon_all"
  on public.restaurant_app_state for all
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_app_state.restaurant_id
        and r.slug = 'gwada-demo'
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_app_state.restaurant_id
        and r.slug = 'gwada-demo'
    )
  );
