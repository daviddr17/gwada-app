-- Checklisten Phase 1: Bereiche & Geräte (Chips) + erweiterte ToDo-Felder

create table public.restaurant_checklist_areas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  background_color text not null default '#64748b',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_checklist_areas_name_len check (
    char_length(trim(name)) between 1 and 80
  )
);

create index restaurant_checklist_areas_restaurant_idx
  on public.restaurant_checklist_areas (restaurant_id, sort_order, name);

create trigger restaurant_checklist_areas_set_updated_at
  before update on public.restaurant_checklist_areas
  for each row execute function public.set_updated_at();

create table public.restaurant_checklist_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  area_id uuid references public.restaurant_checklist_areas (id) on delete set null,
  target_min numeric,
  target_max numeric,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_checklist_devices_name_len check (
    char_length(trim(name)) between 1 and 120
  )
);

create index restaurant_checklist_devices_restaurant_idx
  on public.restaurant_checklist_devices (restaurant_id, sort_order, name);

create index restaurant_checklist_devices_area_idx
  on public.restaurant_checklist_devices (area_id)
  where area_id is not null;

create trigger restaurant_checklist_devices_set_updated_at
  before update on public.restaurant_checklist_devices
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_todos
  add column if not exists recurrence text,
  add column if not exists capture_type text not null default 'boolean',
  add column if not exists target_min numeric,
  add column if not exists target_max numeric,
  add column if not exists checklist_device_id uuid references public.restaurant_checklist_devices (id) on delete set null,
  add column if not exists checklist_area_id uuid references public.restaurant_checklist_areas (id) on delete set null,
  add column if not exists require_corrective_on_deviation boolean not null default false;

alter table public.restaurant_staff_todos
  drop constraint if exists restaurant_staff_todos_recurrence_check;

alter table public.restaurant_staff_todos
  add constraint restaurant_staff_todos_recurrence_check check (
    recurrence is null
    or recurrence in ('hourly', 'daily', 'weekly', 'monthly', 'ad_hoc')
  );

alter table public.restaurant_staff_todos
  drop constraint if exists restaurant_staff_todos_capture_type_check;

alter table public.restaurant_staff_todos
  add constraint restaurant_staff_todos_capture_type_check check (
    capture_type in ('none', 'boolean', 'temperature', 'number', 'text')
  );

create index restaurant_staff_todos_checklist_device_idx
  on public.restaurant_staff_todos (checklist_device_id)
  where checklist_device_id is not null;

create index restaurant_staff_todos_checklist_area_idx
  on public.restaurant_staff_todos (checklist_area_id)
  where checklist_area_id is not null;

alter table public.restaurant_staff_todo_completions
  add column if not exists captured_numeric numeric,
  add column if not exists captured_text text,
  add column if not exists within_limits boolean,
  add column if not exists corrective_action text;

alter table public.restaurant_checklist_areas enable row level security;
alter table public.restaurant_checklist_devices enable row level security;

create policy restaurant_checklist_areas_select
  on public.restaurant_checklist_areas for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.read'));

create policy restaurant_checklist_areas_write
  on public.restaurant_checklist_areas for all to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update'));

create policy restaurant_checklist_devices_select
  on public.restaurant_checklist_devices for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.read'));

create policy restaurant_checklist_devices_write
  on public.restaurant_checklist_devices for all to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update'));
