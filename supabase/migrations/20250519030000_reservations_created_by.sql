-- Wer die Reservierung angelegt hat (App-Nutzer); null = Gast (z. B. externes Formular).

alter table public.reservations
  add column if not exists created_by_profile_id uuid
    references public.profiles (id) on delete set null;

comment on column public.reservations.created_by_profile_id is
  'Angemeldeter App-Nutzer bei Anlage; null = Gast ohne App-Login.';

create or replace function public.reservations_set_created_by_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_profile_id is null then
    new.created_by_profile_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_set_created_by on public.reservations;

create trigger reservations_set_created_by
  before insert on public.reservations
  for each row
  execute function public.reservations_set_created_by_profile();

-- Kolleg:innen im gleichen Restaurant dürfen Namen für „Erstellt von“ lesen.
drop policy if exists "profiles_select_restaurant_coworkers" on public.profiles;

create policy "profiles_select_restaurant_coworkers"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.restaurant_employees re_me
      join public.restaurant_employees re_other
        on re_other.restaurant_id = re_me.restaurant_id
      where re_me.profile_id = (select auth.uid())
        and re_me.is_active
        and re_other.profile_id = profiles.id
        and re_other.is_active
    )
  );
