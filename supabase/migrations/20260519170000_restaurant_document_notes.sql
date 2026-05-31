-- Dokument-Notizen: bearbeitbare interne Notiz + protokollartige Einträge.

alter table public.restaurant_documents
  add column if not exists internal_note text;

alter table public.restaurant_documents
  drop constraint if exists restaurant_documents_internal_note_len;

alter table public.restaurant_documents
  add constraint restaurant_documents_internal_note_len check (
    internal_note is null or char_length(internal_note) <= 5000
  );

create or replace function public.restaurant_documents_guard_internal_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.internal_note is distinct from old.internal_note
    and not public.auth_has_restaurant_permission(new.restaurant_id, 'documents.notes.edit')
  then
    raise exception 'forbidden_internal_note_edit' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists restaurant_documents_internal_note_guard on public.restaurant_documents;

create trigger restaurant_documents_internal_note_guard
  before update of internal_note on public.restaurant_documents
  for each row execute function public.restaurant_documents_guard_internal_note();

-- ---------------------------------------------------------------------------
-- Protokollartige Notiz-Einträge (append-only)
-- ---------------------------------------------------------------------------
create table public.restaurant_document_note_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  document_id uuid not null references public.restaurant_documents (id) on delete cascade,
  employee_id uuid references public.restaurant_employees (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_document_note_body_len check (char_length(body) between 1 and 5000)
);

create index restaurant_document_note_entries_document_created_idx
  on public.restaurant_document_note_entries (document_id, created_at desc);

alter table public.restaurant_document_note_entries enable row level security;

create policy restaurant_document_note_entries_staff_select
  on public.restaurant_document_note_entries for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_document_note_entries_staff_insert
  on public.restaurant_document_note_entries for insert
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_document_note_entries is
  'Append-only Notizen pro Dokument (für Rollen ohne documents.notes.edit).';

comment on column public.restaurant_documents.internal_note is
  'Bearbeitbare Kurznotiz; Änderung nur mit documents.notes.edit.';

-- Protokoll: Notiz-Aktionen
alter table public.restaurant_document_log_entries
  drop constraint if exists restaurant_document_log_entries_action_check;

alter table public.restaurant_document_log_entries
  add constraint restaurant_document_log_entries_action_check
  check (action in ('uploaded', 'updated', 'deleted', 'note_updated', 'note_added'));
