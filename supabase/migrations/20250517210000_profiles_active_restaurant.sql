-- Active workspace restaurant per user (used with authenticated Supabase session).

alter table public.profiles
  add column if not exists active_restaurant_id uuid references public.restaurants (id) on delete set null;

create index if not exists profiles_active_restaurant_id_idx
  on public.profiles (active_restaurant_id);

comment on column public.profiles.active_restaurant_id is
  'Restaurant the user is editing; must be a restaurant they belong to (enforced in RLS).';

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and (
      active_restaurant_id is null
      or exists (
        select 1 from public.restaurant_employees re
        where re.restaurant_id = profiles.active_restaurant_id
          and re.profile_id = (select auth.uid())
          and re.is_active
      )
    )
  );
