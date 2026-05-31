-- Restaurant documents: tags, file metadata, private storage (1 GB / restaurant).

-- ---------------------------------------------------------------------------
-- Tags (like menu_tags)
-- ---------------------------------------------------------------------------
create table public.restaurant_document_tags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  background_color text not null default '#64748b',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_document_tags_name_len check (char_length(name) between 1 and 120)
);

create index restaurant_document_tags_restaurant_sort_idx
  on public.restaurant_document_tags (restaurant_id, sort_order, name);

create trigger restaurant_document_tags_set_updated_at
  before update on public.restaurant_document_tags
  for each row execute function public.set_updated_at();

alter table public.restaurant_document_tags enable row level security;

create policy restaurant_document_tags_staff_all
  on public.restaurant_document_tags for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Documents (employee_id reserved for future Mitarbeiter module)
-- ---------------------------------------------------------------------------
create table public.restaurant_documents (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tag_id uuid references public.restaurant_document_tags (id) on delete set null,
  employee_id uuid references public.restaurant_employees (id) on delete set null,
  title text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_documents_title_len check (char_length(title) between 1 and 255),
  constraint restaurant_documents_file_name_len check (char_length(file_name) between 1 and 512),
  constraint restaurant_documents_size_positive check (size_bytes > 0)
);

create unique index restaurant_documents_storage_path_idx
  on public.restaurant_documents (storage_path);

create index restaurant_documents_restaurant_created_idx
  on public.restaurant_documents (restaurant_id, created_at desc);

create index restaurant_documents_restaurant_tag_idx
  on public.restaurant_documents (restaurant_id, tag_id);

create index restaurant_documents_employee_idx
  on public.restaurant_documents (employee_id)
  where employee_id is not null;

create trigger restaurant_documents_set_updated_at
  before update on public.restaurant_documents
  for each row execute function public.set_updated_at();

alter table public.restaurant_documents enable row level security;

create policy restaurant_documents_staff_all
  on public.restaurant_documents for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- Employee must belong to the same restaurant when set.
create or replace function public.restaurant_documents_employee_same_restaurant()
returns trigger
language plpgsql
as $$
begin
  if new.employee_id is not null then
    if not exists (
      select 1
      from public.restaurant_employees re
      where re.id = new.employee_id
        and re.restaurant_id = new.restaurant_id
    ) then
      raise exception 'employee_must_belong_to_restaurant'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger restaurant_documents_employee_restaurant_check
  before insert or update of employee_id, restaurant_id
  on public.restaurant_documents
  for each row execute function public.restaurant_documents_employee_same_restaurant();

-- 1 GB quota per restaurant (enforced on insert).
create or replace function public.restaurant_documents_quota_bytes()
returns bigint
language sql
immutable
as $$
  select 1073741824::bigint;
$$;

create or replace function public.restaurant_documents_used_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(size_bytes), 0)::bigint
  from public.restaurant_documents
  where restaurant_id = p_restaurant_id;
$$;

grant execute on function public.restaurant_documents_used_bytes(uuid) to authenticated;

create or replace function public.restaurant_documents_enforce_quota()
returns trigger
language plpgsql
as $$
declare
  used bigint;
  quota bigint;
begin
  quota := public.restaurant_documents_quota_bytes();
  select public.restaurant_documents_used_bytes(new.restaurant_id) into used;
  if used + new.size_bytes > quota then
    raise exception 'storage_quota_exceeded'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger restaurant_documents_quota_before_insert
  before insert on public.restaurant_documents
  for each row execute function public.restaurant_documents_enforce_quota();

comment on column public.restaurant_documents.employee_id is
  'Optional link to restaurant_employees for Mitarbeiter-Dokumente (future module).';

-- ---------------------------------------------------------------------------
-- Storage bucket (private; path: {restaurant_id}/{document_id}/{filename})
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-documents',
  'restaurant-documents',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_restaurant_id_from_object_path(object_name text)
returns uuid
language sql
stable
as $$
  select nullif((string_to_array(object_name, '/'))[1], '')::uuid;
$$;

create policy restaurant_documents_storage_select_staff
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'restaurant-documents'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );

create policy restaurant_documents_storage_insert_staff
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'restaurant-documents'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );

create policy restaurant_documents_storage_update_staff
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'restaurant-documents'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  )
  with check (
    bucket_id = 'restaurant-documents'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );

create policy restaurant_documents_storage_delete_staff
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'restaurant-documents'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );
