-- Lexoffice: PDF-Import-Deduplizierung (Sync/Webhook → Dokumente)
create table if not exists public.restaurant_lexoffice_document_imports (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  lexoffice_resource_type text not null,
  lexoffice_resource_id uuid not null,
  document_id uuid references public.restaurant_documents (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, lexoffice_resource_type, lexoffice_resource_id)
);

create index if not exists restaurant_lexoffice_document_imports_document_idx
  on public.restaurant_lexoffice_document_imports (document_id)
  where document_id is not null;

comment on table public.restaurant_lexoffice_document_imports is
  'Verknüpft importierte Lexware-PDFs mit restaurant_documents (keine Duplikate).';

alter table public.restaurant_lexoffice_document_imports enable row level security;

create policy restaurant_lexoffice_document_imports_select
  on public.restaurant_lexoffice_document_imports
  for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_lexoffice_document_imports_service
  on public.restaurant_lexoffice_document_imports
  for all
  to service_role
  using (true)
  with check (true);
