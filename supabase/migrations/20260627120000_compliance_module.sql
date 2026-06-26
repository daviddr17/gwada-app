-- Eigenkontrolle (HACCP-Checklisten): Geräte, Vorlagen, Einträge, Protokoll

do $$ begin
  alter type public.display_module add value if not exists 'compliance';
exception
  when duplicate_object then null;
end $$;

create table public.restaurant_compliance_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  device_type text not null default 'fridge',
  location text,
  target_min numeric,
  target_max numeric,
  is_active boolean not null default true,
  archived_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_compliance_devices_name_len check (char_length(name) between 1 and 120),
  constraint restaurant_compliance_devices_location_len check (
    location is null or char_length(location) <= 200
  ),
  constraint restaurant_compliance_devices_type_check check (
    device_type in ('fridge', 'freezer', 'cold_room', 'probe', 'other')
  )
);

create index restaurant_compliance_devices_restaurant_active_idx
  on public.restaurant_compliance_devices (restaurant_id, sort_order, name)
  where archived_at is null;

create trigger restaurant_compliance_devices_set_updated_at
  before update on public.restaurant_compliance_devices
  for each row execute function public.set_updated_at();

create table public.restaurant_compliance_checklists (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  frequency text not null default 'daily',
  items jsonb not null default '[]'::jsonb,
  show_on_display boolean not null default true,
  is_active boolean not null default true,
  archived_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_compliance_checklists_name_len check (char_length(name) between 1 and 200),
  constraint restaurant_compliance_checklists_description_len check (
    description is null or char_length(description) <= 2000
  ),
  constraint restaurant_compliance_checklists_category_check check (
    category in (
      'temperature',
      'cleaning',
      'goods_receipt',
      'hot_hold',
      'cooking',
      'other'
    )
  ),
  constraint restaurant_compliance_checklists_frequency_check check (
    frequency in ('daily', 'weekly', 'monthly', 'per_delivery', 'ad_hoc')
  ),
  constraint restaurant_compliance_checklists_items_is_array check (
    jsonb_typeof(items) = 'array'
  )
);

create index restaurant_compliance_checklists_restaurant_active_idx
  on public.restaurant_compliance_checklists (restaurant_id, category, sort_order)
  where archived_at is null;

create trigger restaurant_compliance_checklists_set_updated_at
  before update on public.restaurant_compliance_checklists
  for each row execute function public.set_updated_at();

create table public.restaurant_compliance_records (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  checklist_id uuid not null references public.restaurant_compliance_checklists (id) on delete restrict,
  performed_at timestamptz not null default now(),
  performed_by_staff_id uuid references public.restaurant_staff (id) on delete set null,
  performed_by_user_id uuid references public.profiles (id) on delete set null,
  values jsonb not null default '{}'::jsonb,
  corrective_action text,
  notes text,
  has_deviation boolean not null default false,
  source text not null default 'dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_compliance_records_corrective_len check (
    corrective_action is null or char_length(corrective_action) <= 4000
  ),
  constraint restaurant_compliance_records_notes_len check (
    notes is null or char_length(notes) <= 4000
  ),
  constraint restaurant_compliance_records_source_check check (
    source in ('dashboard', 'display')
  ),
  constraint restaurant_compliance_records_values_is_object check (
    jsonb_typeof(values) = 'object'
  )
);

create index restaurant_compliance_records_restaurant_performed_idx
  on public.restaurant_compliance_records (restaurant_id, performed_at desc);

create index restaurant_compliance_records_checklist_idx
  on public.restaurant_compliance_records (checklist_id, performed_at desc);

create trigger restaurant_compliance_records_set_updated_at
  before update on public.restaurant_compliance_records
  for each row execute function public.set_updated_at();

create table public.restaurant_compliance_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  checklist_id uuid references public.restaurant_compliance_checklists (id) on delete set null,
  record_id uuid references public.restaurant_compliance_records (id) on delete set null,
  device_id uuid references public.restaurant_compliance_devices (id) on delete set null,
  action text not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_staff_id uuid references public.restaurant_staff (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint restaurant_compliance_log_action_check check (
    action in (
      'checklist_created',
      'checklist_updated',
      'checklist_archived',
      'device_created',
      'device_updated',
      'device_archived',
      'record_created',
      'record_updated',
      'templates_seeded'
    )
  )
);

create index restaurant_compliance_log_restaurant_created_idx
  on public.restaurant_compliance_log_entries (restaurant_id, created_at desc);

create table public.restaurant_compliance_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  require_corrective_on_deviation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger restaurant_compliance_settings_set_updated_at
  before update on public.restaurant_compliance_settings
  for each row execute function public.set_updated_at();

-- documents.manage → compliance CRUD für bestehende Positionen
insert into public.restaurant_position_permissions (position_id, permission_key)
select rpp.position_id, 'compliance.' || op.op
from public.restaurant_position_permissions rpp
cross join (
  values ('read'), ('create'), ('update'), ('delete')
) as op(op)
where rpp.permission_key = 'documents.manage'
on conflict do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'display.compliance'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager', 'kitchen')
on conflict do nothing;

create or replace function public.auth_has_restaurant_permission(
  p_restaurant_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_suffix text;
  v_module_prefixes text[] := array[
    'menu', 'inventory', 'reservations', 'contacts', 'news', 'events',
    'reviews', 'documents', 'staff', 'accounting', 'staff_todos', 'compliance'
  ];
begin
  if p_permission is null or p_permission = '' then
    return false;
  end if;

  if exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = p_permission
  ) then
    return true;
  end if;

  v_prefix := split_part(p_permission, '.', 1);
  v_suffix := split_part(p_permission, '.', 2);

  if v_prefix = 'staff_todos' and exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = 'staff.manage'
  ) then
    return true;
  end if;

  if v_prefix = 'compliance' and exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = 'documents.manage'
  ) then
    return true;
  end if;

  if not (v_prefix = any (v_module_prefixes)) then
    return false;
  end if;

  if v_suffix = 'manage' then
    return exists (
      select 1
      from public.restaurant_employees re
      inner join public.restaurant_position_permissions rpp
        on rpp.position_id = re.position_id
      where re.restaurant_id = p_restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.position_id is not null
        and (
          rpp.permission_key = p_permission
          or rpp.permission_key in (
            v_prefix || '.read',
            v_prefix || '.create',
            v_prefix || '.update',
            v_prefix || '.delete'
          )
        )
    );
  end if;

  if exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = v_prefix || '.manage'
  ) then
    return true;
  end if;

  if v_suffix = 'read' then
    return exists (
      select 1
      from public.restaurant_employees re
      inner join public.restaurant_position_permissions rpp
        on rpp.position_id = re.position_id
      where re.restaurant_id = p_restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.position_id is not null
        and rpp.permission_key in (
          v_prefix || '.create',
          v_prefix || '.update',
          v_prefix || '.delete'
        )
    );
  end if;

  return false;
end;
$$;

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
    'display.kds',
    'display.module_switch'
  ]::text[])
  from resolved r
  inner join public.restaurant_positions rp on rp.id = r.position_id
  where rp.slug = 'owner';
$$;

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
    'documents.notes.edit',
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

alter table public.restaurant_compliance_devices enable row level security;
alter table public.restaurant_compliance_checklists enable row level security;
alter table public.restaurant_compliance_records enable row level security;
alter table public.restaurant_compliance_log_entries enable row level security;
alter table public.restaurant_compliance_settings enable row level security;

create policy restaurant_compliance_devices_select
  on public.restaurant_compliance_devices for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.read'));

create policy restaurant_compliance_devices_insert
  on public.restaurant_compliance_devices for insert to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'compliance.create'));

create policy restaurant_compliance_devices_update
  on public.restaurant_compliance_devices for update to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'));

create policy restaurant_compliance_devices_delete
  on public.restaurant_compliance_devices for delete to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.delete'));

create policy restaurant_compliance_checklists_select
  on public.restaurant_compliance_checklists for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.read'));

create policy restaurant_compliance_checklists_insert
  on public.restaurant_compliance_checklists for insert to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'compliance.create'));

create policy restaurant_compliance_checklists_update
  on public.restaurant_compliance_checklists for update to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'));

create policy restaurant_compliance_checklists_delete
  on public.restaurant_compliance_checklists for delete to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.delete'));

create policy restaurant_compliance_records_select
  on public.restaurant_compliance_records for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.read'));

create policy restaurant_compliance_records_insert
  on public.restaurant_compliance_records for insert to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'compliance.create'));

create policy restaurant_compliance_records_update
  on public.restaurant_compliance_records for update to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'));

create policy restaurant_compliance_records_delete
  on public.restaurant_compliance_records for delete to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.delete'));

create policy restaurant_compliance_log_select
  on public.restaurant_compliance_log_entries for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.read'));

create policy restaurant_compliance_log_insert
  on public.restaurant_compliance_log_entries for insert to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'));

create policy restaurant_compliance_settings_select
  on public.restaurant_compliance_settings for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.read'));

create policy restaurant_compliance_settings_write
  on public.restaurant_compliance_settings for all to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'compliance.update'));
