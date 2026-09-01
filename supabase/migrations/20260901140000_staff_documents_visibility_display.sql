-- Mitarbeiter-Dokumente: Sichtbarkeit pro Dokument + Display-Modul + Benachrichtigungen

alter table public.restaurant_documents
  add column if not exists visible_to_staff boolean not null default false;

comment on column public.restaurant_documents.visible_to_staff is
  'Wenn staff_id gesetzt: Dokument im Profil/Display für den Mitarbeiter sichtbar. HR sieht immer.';

-- Bestehende Zuordnungen: bisher implizit sichtbar
update public.restaurant_documents
set visible_to_staff = true
where staff_id is not null
  and visible_to_staff = false;

drop policy if exists "restaurant_documents_select_own_staff"
  on public.restaurant_documents;

create policy "restaurant_documents_select_own_staff"
  on public.restaurant_documents for select
  to authenticated
  using (
    staff_id is not null
    and visible_to_staff = true
    and exists (
      select 1
      from public.restaurant_staff rs
      where rs.id = restaurant_documents.staff_id
        and rs.restaurant_id = restaurant_documents.restaurant_id
        and rs.profile_id = (select auth.uid())
    )
  );

create table if not exists public.restaurant_staff_document_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  document_id uuid not null references public.restaurant_documents (id) on delete cascade,
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id, document_id)
);

create index if not exists restaurant_staff_document_notification_dismissals_restaurant_idx
  on public.restaurant_staff_document_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_staff_document_notification_dismissals enable row level security;

create policy restaurant_staff_document_notification_dismissals_own
  on public.restaurant_staff_document_notification_dismissals for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Display-Modul: Dokumente
do $$ begin
  alter type public.display_module add value if not exists 'documents';
exception
  when duplicate_object then null;
end $$;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'display.documents'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create or replace function public.staff_display_permission_keys(p_staff_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  with resolved as (
    select
      rs.id as staff_id,
      coalesce(re.position_id, rs.restaurant_position_id) as position_id
    from public.restaurant_staff rs
    left join public.restaurant_employees re on re.id = rs.employee_id
    where rs.id = p_staff_id
      and rs.is_active
  )
  select distinct rpp.permission_key
  from resolved r
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = r.position_id
  where r.position_id is not null
  union
  select unnest(array[
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.inventory',
    'display.compliance',
    'display.documents',
    'display.kds',
    'display.module_switch'
  ]::text[])
  from resolved r
  inner join public.restaurant_positions rp on rp.id = r.position_id
  where rp.slug = 'owner';
$$;
