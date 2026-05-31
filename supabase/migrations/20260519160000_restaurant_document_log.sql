-- Änderungs-/Upload-Protokoll für Restaurant-Dokumente.

create table public.restaurant_document_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  document_id uuid references public.restaurant_documents (id) on delete set null,
  employee_id uuid references public.restaurant_employees (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('uploaded', 'updated', 'deleted')),
  document_title text not null,
  file_name text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_document_log_title_len check (char_length(document_title) between 1 and 255)
);

create index restaurant_document_log_restaurant_created_idx
  on public.restaurant_document_log_entries (restaurant_id, created_at desc);

create index restaurant_document_log_document_created_idx
  on public.restaurant_document_log_entries (document_id, created_at desc)
  where document_id is not null;

alter table public.restaurant_document_log_entries enable row level security;

create policy restaurant_document_log_staff_select
  on public.restaurant_document_log_entries for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_document_log_staff_insert
  on public.restaurant_document_log_entries for insert
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_document_log_entries is
  'Audit trail: uploads, metadata changes, deletions (restaurant-wide, actor snapshot in details).';
