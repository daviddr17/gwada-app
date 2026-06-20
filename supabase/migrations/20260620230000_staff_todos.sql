-- Mitarbeiter: ToDo-Listen (Schema + staff_todos Berechtigungen)

create table public.restaurant_staff_todos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null,
  description text,
  assignee_type text not null,
  staff_id uuid references public.restaurant_staff (id) on delete cascade,
  position_tag_id uuid references public.restaurant_staff_position_tags (id) on delete cascade,
  priority text not null default 'medium',
  display_from timestamptz,
  display_until timestamptz,
  show_on_display boolean not null default true,
  show_before_clock_in boolean not null default false,
  show_before_break_start boolean not null default false,
  show_before_break_end boolean not null default false,
  show_before_clock_out boolean not null default false,
  completion_mode text not null default 'any_one',
  require_defer_reason boolean not null default false,
  blocks_shift_end boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_staff_todos_title_len check (char_length(title) between 1 and 200),
  constraint restaurant_staff_todos_description_len check (
    description is null or char_length(description) <= 4000
  ),
  constraint restaurant_staff_todos_assignee_type_check check (
    assignee_type in ('staff', 'position_tag')
  ),
  constraint restaurant_staff_todos_priority_check check (
    priority in ('high', 'medium', 'low')
  ),
  constraint restaurant_staff_todos_completion_mode_check check (
    completion_mode in ('any_one', 'each_assignee')
  ),
  constraint restaurant_staff_todos_assignee_fk_check check (
    (
      assignee_type = 'staff'
      and staff_id is not null
      and position_tag_id is null
    )
    or (
      assignee_type = 'position_tag'
      and position_tag_id is not null
      and staff_id is null
    )
  )
);

create index restaurant_staff_todos_restaurant_active_idx
  on public.restaurant_staff_todos (restaurant_id, sort_order, created_at desc)
  where archived_at is null;

create index restaurant_staff_todos_staff_idx
  on public.restaurant_staff_todos (staff_id)
  where staff_id is not null;

create index restaurant_staff_todos_position_tag_idx
  on public.restaurant_staff_todos (position_tag_id)
  where position_tag_id is not null;

create trigger restaurant_staff_todos_set_updated_at
  before update on public.restaurant_staff_todos
  for each row execute function public.set_updated_at();

create table public.restaurant_staff_todo_completions (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.restaurant_staff_todos (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  completed_at timestamptz not null default now(),
  reopened_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint restaurant_staff_todo_completions_unique unique (todo_id, staff_id)
);

create index restaurant_staff_todo_completions_todo_idx
  on public.restaurant_staff_todo_completions (todo_id);

create table public.restaurant_staff_todo_deferrals (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.restaurant_staff_todos (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  trigger_type text not null,
  reason text,
  deferred_at timestamptz not null default now(),
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  constraint restaurant_staff_todo_deferrals_trigger_check check (
    trigger_type in ('clock_in', 'break_start', 'break_end', 'clock_out')
  )
);

create index restaurant_staff_todo_deferrals_todo_staff_idx
  on public.restaurant_staff_todo_deferrals (todo_id, staff_id)
  where cleared_at is null;

create table public.restaurant_staff_todo_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  todo_id uuid references public.restaurant_staff_todos (id) on delete set null,
  action text not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_staff_id uuid references public.restaurant_staff (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint restaurant_staff_todo_log_action_check check (
    action in (
      'created',
      'updated',
      'archived',
      'completed',
      'reopened',
      'deferred',
      'completed_by_manager'
    )
  )
);

create index restaurant_staff_todo_log_restaurant_created_idx
  on public.restaurant_staff_todo_log_entries (restaurant_id, created_at desc);

create table public.restaurant_staff_todo_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  defer_reason_default text,
  notify_on_completed boolean not null default true,
  notify_on_deferred boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger restaurant_staff_todo_settings_set_updated_at
  before update on public.restaurant_staff_todo_settings
  for each row execute function public.set_updated_at();

-- staff.manage → staff_todos CRUD für bestehende Positionen
insert into public.restaurant_position_permissions (position_id, permission_key)
select rpp.position_id, 'staff_todos.' || op.op
from public.restaurant_position_permissions rpp
cross join (
  values ('read'), ('create'), ('update'), ('delete')
) as op(op)
where rpp.permission_key = 'staff.manage'
on conflict do nothing;

-- auth_has_restaurant_permission: staff_todos + staff.manage-Legacy
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
    'reviews', 'documents', 'staff', 'accounting', 'staff_todos'
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

  -- Legacy staff.manage → volle staff_todos-Rechte
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
    'menu.read', 'menu.create', 'menu.update', 'menu.delete',
    'inventory.read', 'inventory.create', 'inventory.update', 'inventory.delete',
    'reservations.read', 'reservations.create', 'reservations.update', 'reservations.delete',
    'contacts.read', 'contacts.create', 'contacts.update', 'contacts.delete',
    'news.read', 'news.create', 'news.update', 'news.delete',
    'events.read', 'events.create', 'events.update', 'events.delete',
    'reviews.read', 'reviews.create', 'reviews.update', 'reviews.delete',
    'gallery.read',
    'gallery.create',
    'gallery.update',
    'gallery.delete',
    'documents.read', 'documents.create', 'documents.update', 'documents.delete',
    'documents.notes.edit',
    'staff.read', 'staff.create', 'staff.update', 'staff.delete',
    'staff_todos.read', 'staff_todos.create', 'staff_todos.update', 'staff_todos.delete',
    'accounting.read', 'accounting.create', 'accounting.update', 'accounting.delete',
    'display.manage',
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.inventory',
    'display.kds',
    'display.module_switch',
    'pos.kasse.manage',
    'pos.kasse.export'
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

-- RLS
alter table public.restaurant_staff_todos enable row level security;
alter table public.restaurant_staff_todo_completions enable row level security;
alter table public.restaurant_staff_todo_deferrals enable row level security;
alter table public.restaurant_staff_todo_log_entries enable row level security;
alter table public.restaurant_staff_todo_settings enable row level security;

create policy restaurant_staff_todos_select
  on public.restaurant_staff_todos for select
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.read')
  );

create policy restaurant_staff_todos_insert
  on public.restaurant_staff_todos for insert
  to authenticated
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.create')
  );

create policy restaurant_staff_todos_update
  on public.restaurant_staff_todos for update
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update')
  );

create policy restaurant_staff_todos_delete
  on public.restaurant_staff_todos for delete
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.delete')
  );

create policy restaurant_staff_todo_completions_select
  on public.restaurant_staff_todo_completions for select
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.read')
    )
  );

create policy restaurant_staff_todo_completions_write
  on public.restaurant_staff_todo_completions for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.update')
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.update')
    )
  );

create policy restaurant_staff_todo_deferrals_select
  on public.restaurant_staff_todo_deferrals for select
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.read')
    )
  );

create policy restaurant_staff_todo_deferrals_write
  on public.restaurant_staff_todo_deferrals for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.update')
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.update')
    )
  );

create policy restaurant_staff_todo_log_select
  on public.restaurant_staff_todo_log_entries for select
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.read')
  );

create policy restaurant_staff_todo_log_insert
  on public.restaurant_staff_todo_log_entries for insert
  to authenticated
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update')
  );

create policy restaurant_staff_todo_settings_select
  on public.restaurant_staff_todo_settings for select
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.read')
  );

create policy restaurant_staff_todo_settings_write
  on public.restaurant_staff_todo_settings for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'staff_todos.update')
  );
