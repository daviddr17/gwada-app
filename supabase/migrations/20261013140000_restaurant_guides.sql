-- Anleitungen (SOPs/Guides) unter Aufgaben: Schema, Rechte, Storage, Display
-- (Dev-DB-Push: Missing-relfilenode repair in deploy scripts)

do $$ begin
  alter type public.display_module add value if not exists 'guides';
exception
  when duplicate_object then null;
end $$;

create table public.restaurant_guides (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null,
  short_description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  -- Stub for later attach-to-todo UI (nullable FK, no UI yet)
  linked_staff_todo_id uuid references public.restaurant_staff_todos (id) on delete set null,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_guides_title_len check (char_length(title) between 1 and 200),
  constraint restaurant_guides_short_description_len check (
    short_description is null or char_length(short_description) <= 500
  )
);

create index restaurant_guides_restaurant_active_idx
  on public.restaurant_guides (restaurant_id, sort_order, title)
  where archived_at is null;

create index restaurant_guides_linked_todo_idx
  on public.restaurant_guides (linked_staff_todo_id)
  where linked_staff_todo_id is not null;

create trigger restaurant_guides_set_updated_at
  before update on public.restaurant_guides
  for each row execute function public.set_updated_at();

create table public.restaurant_guide_steps (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.restaurant_guides (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  position integer not null default 0,
  body text not null default '',
  image_storage_path text,
  image_mime text,
  image_size_bytes bigint,
  video_storage_path text,
  video_mime text,
  video_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_guide_steps_body_len check (char_length(body) <= 8000),
  constraint restaurant_guide_steps_position_nonneg check (position >= 0),
  constraint restaurant_guide_steps_image_size_nonneg check (
    image_size_bytes is null or image_size_bytes >= 0
  ),
  constraint restaurant_guide_steps_video_size_nonneg check (
    video_size_bytes is null or video_size_bytes >= 0
  ),
  constraint restaurant_guide_steps_image_path_pair check (
    (image_storage_path is null and image_mime is null and image_size_bytes is null)
    or (image_storage_path is not null and image_mime is not null)
  ),
  constraint restaurant_guide_steps_video_path_pair check (
    (video_storage_path is null and video_mime is null and video_size_bytes is null)
    or (video_storage_path is not null and video_mime is not null)
  )
);

create index restaurant_guide_steps_guide_position_idx
  on public.restaurant_guide_steps (guide_id, position);

create index restaurant_guide_steps_restaurant_idx
  on public.restaurant_guide_steps (restaurant_id);

create trigger restaurant_guide_steps_set_updated_at
  before update on public.restaurant_guide_steps
  for each row execute function public.set_updated_at();

-- staff_todos CRUD → guides CRUD für bestehende Positionen
insert into public.restaurant_position_permissions (position_id, permission_key)
select rpp.position_id, 'guides.' || op.op
from public.restaurant_position_permissions rpp
cross join (
  values ('read'), ('create'), ('update'), ('delete')
) as op(op)
where rpp.permission_key = 'staff_todos.' || op.op
on conflict do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rpp.position_id, 'guides.' || op.op
from public.restaurant_position_permissions rpp
cross join (
  values ('read'), ('create'), ('update'), ('delete')
) as op(op)
where rpp.permission_key = 'staff_todos.manage'
on conflict do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'display.guides'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager', 'kitchen', 'server')
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
    'reviews', 'documents', 'staff', 'accounting', 'insights',
    'staff_todos', 'compliance', 'guides'
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

  if v_prefix = 'guides' and exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = 'staff_todos.manage'
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
        and (
          rpp.permission_key = p_permission
          or rpp.permission_key = v_prefix || '.manage'
          or rpp.permission_key in (
            v_prefix || '.create',
            v_prefix || '.update',
            v_prefix || '.delete'
          )
        )
    );
  end if;

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
        or rpp.permission_key = v_prefix || '.manage'
      )
  );
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
    'display.guides',
    'display.profile',
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
    'integrations.tripadvisor',
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
    'display.guides',
    'display.profile',
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
    'guides.read',
    'guides.create',
    'guides.update',
    'guides.delete',
    'staff_todos.read',
    'staff_todos.create',
    'staff_todos.update',
    'staff_todos.delete',
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

alter table public.restaurant_guides enable row level security;
alter table public.restaurant_guide_steps enable row level security;

create policy restaurant_guides_select
  on public.restaurant_guides for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.read'));

create policy restaurant_guides_insert
  on public.restaurant_guides for insert to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'guides.create'));

create policy restaurant_guides_update
  on public.restaurant_guides for update to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'guides.update'));

create policy restaurant_guides_delete
  on public.restaurant_guides for delete to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.delete'));

create policy restaurant_guide_steps_select
  on public.restaurant_guide_steps for select to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.read'));

create policy restaurant_guide_steps_insert
  on public.restaurant_guide_steps for insert to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'guides.create'));

create policy restaurant_guide_steps_update
  on public.restaurant_guide_steps for update to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.update'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'guides.update'));

create policy restaurant_guide_steps_delete
  on public.restaurant_guide_steps for delete to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'guides.delete'));

-- Workspace storage accounting
create or replace function public.restaurant_guides_used_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    sum(coalesce(image_size_bytes, 0) + coalesce(video_size_bytes, 0)),
    0
  )::bigint
  from public.restaurant_guide_steps
  where restaurant_id = p_restaurant_id;
$$;

create or replace function public.restaurant_workspace_used_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    public.restaurant_documents_used_bytes(p_restaurant_id)
    + public.restaurant_gallery_used_bytes(p_restaurant_id)
    + public.restaurant_news_media_used_bytes(p_restaurant_id)
    + public.restaurant_accounting_storage_used_bytes(p_restaurant_id)
    + public.restaurant_guides_used_bytes(p_restaurant_id);
$$;

create or replace function public.restaurant_workspace_storage_breakdown(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'documentsBytes', public.restaurant_documents_used_bytes(p_restaurant_id),
    'galleryBytes', public.restaurant_gallery_used_bytes(p_restaurant_id),
    'newsBytes', public.restaurant_news_media_used_bytes(p_restaurant_id),
    'accountingBytes', public.restaurant_accounting_storage_used_bytes(p_restaurant_id),
    'guidesBytes', public.restaurant_guides_used_bytes(p_restaurant_id),
    'totalBytes', public.restaurant_workspace_used_bytes(p_restaurant_id),
    'quotaBytes', public.restaurant_workspace_quota_bytes(p_restaurant_id)
  );
$$;

grant execute on function public.restaurant_guides_used_bytes(uuid) to authenticated;
grant execute on function public.restaurant_workspace_used_bytes(uuid) to authenticated;
grant execute on function public.restaurant_workspace_storage_breakdown(uuid) to authenticated;

create or replace function public.restaurant_guide_steps_enforce_quota()
returns trigger
language plpgsql
as $$
declare
  used bigint;
  quota bigint;
  delta bigint;
begin
  delta := coalesce(new.image_size_bytes, 0) + coalesce(new.video_size_bytes, 0)
    - case
        when tg_op = 'UPDATE' then
          coalesce(old.image_size_bytes, 0) + coalesce(old.video_size_bytes, 0)
        else 0
      end;
  if delta <= 0 then
    return new;
  end if;
  quota := public.restaurant_workspace_quota_bytes(new.restaurant_id);
  select public.restaurant_workspace_used_bytes(new.restaurant_id) into used;
  if used + delta > quota then
    raise exception 'storage_quota_exceeded'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger restaurant_guide_steps_quota_before_insert
  before insert on public.restaurant_guide_steps
  for each row execute function public.restaurant_guide_steps_enforce_quota();

create trigger restaurant_guide_steps_quota_before_update
  before update on public.restaurant_guide_steps
  for each row execute function public.restaurant_guide_steps_enforce_quota();

-- Storage bucket guides-media (images + video, 100 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guides-media',
  'guides-media',
  false,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy guides_media_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'guides-media'
    and public.auth_has_restaurant_permission(
      (storage.foldername(name))[1]::uuid,
      'guides.read'
    )
  );

create policy guides_media_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'guides-media'
    and public.auth_has_restaurant_permission(
      (storage.foldername(name))[1]::uuid,
      'guides.update'
    )
  );

create policy guides_media_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'guides-media'
    and public.auth_has_restaurant_permission(
      (storage.foldername(name))[1]::uuid,
      'guides.update'
    )
  );

create policy guides_media_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'guides-media'
    and public.auth_has_restaurant_permission(
      (storage.foldername(name))[1]::uuid,
      'guides.delete'
    )
  );
