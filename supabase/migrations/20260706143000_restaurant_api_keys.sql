-- Restaurant Public API Keys (read-only v1, pro Modul, optional Domain-Allowlist)

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'settings.api'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create or replace function public.auth_user_restaurant_permission_keys(p_restaurant_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct rpp.permission_key
  from public.restaurant_employees re
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = re.position_id
  where re.restaurant_id = p_restaurant_id
    and re.profile_id = (select auth.uid())
    and re.is_active
    and re.position_id is not null
  union
  select unnest(array[
    'roles.manage',
    'team.manage',
    'integrations.whatsapp',
    'integrations.email',
    'integrations.facebook',
    'integrations.instagram',
    'integrations.google_business',
    'integrations.lexoffice',
    'settings.restaurant',
    'settings.opening_hours',
    'settings.branding',
    'settings.dashboard',
    'settings.api',
    'documents.notes.edit',
    'contacts.messages.protocol',
    'display.manage',
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.inventory',
    'display.compliance',
    'display.kds',
    'display.module_switch',
    'pos.kasse.manage',
    'pos.kasse.export',
    'accounting.manage',
    'news.manage',
    'gallery.read',
    'gallery.create',
    'gallery.update',
    'gallery.delete',
    'events.manage',
    'compliance.read',
    'compliance.create',
    'compliance.update',
    'compliance.delete'
  ]::text[])
  where exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  );
$$;

create table if not exists public.restaurant_api_keys (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  enabled_modules text[] not null default '{}'::text[],
  allowed_origins text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint restaurant_api_keys_name_nonempty check (char_length(trim(name)) > 0),
  constraint restaurant_api_keys_prefix_nonempty check (char_length(key_prefix) >= 12)
);

create unique index if not exists restaurant_api_keys_prefix_active_uidx
  on public.restaurant_api_keys (key_prefix)
  where revoked_at is null;

create index if not exists restaurant_api_keys_restaurant_id_idx
  on public.restaurant_api_keys (restaurant_id);

alter table public.restaurant_api_keys enable row level security;

create policy restaurant_api_keys_select_staff
  on public.restaurant_api_keys
  for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'settings.api')
  );

create policy restaurant_api_keys_insert_staff
  on public.restaurant_api_keys
  for insert
  to authenticated
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'settings.api')
  );

create policy restaurant_api_keys_update_staff
  on public.restaurant_api_keys
  for update
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'settings.api')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'settings.api')
  );
