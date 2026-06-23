-- Digitale Verträge: Arbeitgeber-Stammdaten, Mustervorlagen, PDF-Versionen, MA-Einstellungen.

-- ---------------------------------------------------------------------------
-- Restaurant: Arbeitgeber-Stammdaten für Vertrags-Platzhalter
-- ---------------------------------------------------------------------------
alter table public.restaurants
  add column if not exists legal_name text,
  add column if not exists legal_representative text,
  add column if not exists legal_form text,
  add column if not exists commercial_register text;

alter table public.restaurants
  drop constraint if exists restaurants_legal_name_len_check;

alter table public.restaurants
  add constraint restaurants_legal_name_len_check
  check (legal_name is null or char_length(legal_name) between 1 and 200);

alter table public.restaurants
  drop constraint if exists restaurants_legal_representative_len_check;

alter table public.restaurants
  add constraint restaurants_legal_representative_len_check
  check (
    legal_representative is null
    or char_length(legal_representative) between 1 and 200
  );

alter table public.restaurants
  drop constraint if exists restaurants_legal_form_len_check;

alter table public.restaurants
  add constraint restaurants_legal_form_len_check
  check (legal_form is null or char_length(legal_form) between 1 and 120);

alter table public.restaurants
  drop constraint if exists restaurants_commercial_register_len_check;

alter table public.restaurants
  add constraint restaurants_commercial_register_len_check
  check (
    commercial_register is null
    or char_length(commercial_register) between 1 and 120
  );

comment on column public.restaurants.legal_name is
  'Rechtlicher Name / Firma für Arbeitsverträge (kann vom Anzeigenamen abweichen).';
comment on column public.restaurants.legal_representative is
  'Vertreten durch — z. B. Geschäftsführung (Vertrags-Platzhalter).';
comment on column public.restaurants.legal_form is
  'Rechtsform (z. B. GmbH, Einzelunternehmen).';
comment on column public.restaurants.commercial_register is
  'Handelsregister / HRB-Nummer.';

-- ---------------------------------------------------------------------------
-- Mitarbeiter-Modul: Einstellungen
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_staff_module_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  contract_document_tag_id uuid references public.restaurant_document_tags (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists restaurant_staff_module_settings_set_updated_at
  on public.restaurant_staff_module_settings;

create trigger restaurant_staff_module_settings_set_updated_at
  before update on public.restaurant_staff_module_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_module_settings enable row level security;

drop policy if exists restaurant_staff_module_settings_staff_all
  on public.restaurant_staff_module_settings;

create policy restaurant_staff_module_settings_staff_all
  on public.restaurant_staff_module_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_staff_module_settings is
  'Modulweite Mitarbeiter-Einstellungen (z. B. Dokument-Tag für Vertrags-PDFs).';

-- ---------------------------------------------------------------------------
-- Mustervorlagen pro Beschäftigungsverhältnis
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_staff_contract_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  employment_type_id uuid not null references public.restaurant_staff_employment_types (id) on delete cascade,
  name text not null,
  title text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_contract_templates_name_len check (
    char_length(name) between 1 and 120
  ),
  constraint restaurant_staff_contract_templates_title_len check (
    char_length(title) between 0 and 500
  )
);

create index if not exists restaurant_staff_contract_templates_employment_idx
  on public.restaurant_staff_contract_templates (employment_type_id, sort_order, name);

create trigger restaurant_staff_contract_templates_set_updated_at
  before update on public.restaurant_staff_contract_templates
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_contract_templates enable row level security;

create policy restaurant_staff_contract_templates_staff_all
  on public.restaurant_staff_contract_templates for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_staff_contract_templates is
  'Musterverträge je Beschäftigungsverhältnis (mehrere pro Typ möglich).';

create table if not exists public.restaurant_staff_contract_template_paragraphs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.restaurant_staff_contract_templates (id) on delete cascade,
  sort_order integer not null default 0,
  heading text,
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_contract_template_paragraphs_heading_len check (
    heading is null or char_length(heading) between 1 and 200
  )
);

create index if not exists restaurant_staff_contract_template_paragraphs_template_idx
  on public.restaurant_staff_contract_template_paragraphs (template_id, sort_order);

create trigger restaurant_staff_contract_template_paragraphs_set_updated_at
  before update on public.restaurant_staff_contract_template_paragraphs
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_contract_template_paragraphs enable row level security;

create policy restaurant_staff_contract_template_paragraphs_staff_all
  on public.restaurant_staff_contract_template_paragraphs for all
  using (
    exists (
      select 1
      from public.restaurant_staff_contract_templates t
      where t.id = template_id
        and public.auth_is_restaurant_staff(t.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_staff_contract_templates t
      where t.id = template_id
        and public.auth_is_restaurant_staff(t.restaurant_id)
    )
  );

comment on table public.restaurant_staff_contract_template_paragraphs is
  'Einzelne Paragraphen einer Vertrags-Mustervorlage.';

-- ---------------------------------------------------------------------------
-- Verträge: digitale Erstellung / Unterschrift
-- ---------------------------------------------------------------------------
alter table public.restaurant_staff_contracts
  add column if not exists current_document_id uuid references public.restaurant_documents (id) on delete set null,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by_user_id uuid references auth.users (id) on delete set null,
  add column if not exists contract_body_snapshot jsonb,
  add column if not exists signature_employer jsonb,
  add column if not exists signature_employee jsonb;

comment on column public.restaurant_staff_contracts.current_document_id is
  'Aktuelles Vertrags-PDF in Dokumente (neueste Version).';
comment on column public.restaurant_staff_contracts.contract_body_snapshot is
  'Finaler Vertragstext inkl. Platzhalter-Auflösung beim Abschluss.';
comment on column public.restaurant_staff_contracts.signature_employer is
  'Arbeitgeber-Unterschrift (Name, Zeit, Bild-Pfad o. Ä.).';
comment on column public.restaurant_staff_contracts.signature_employee is
  'Arbeitnehmer-Unterschrift (Name, Zeit, Bild-Pfad o. Ä.).';

create table if not exists public.restaurant_staff_contract_document_versions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  contract_id uuid not null references public.restaurant_staff_contracts (id) on delete cascade,
  document_id uuid not null references public.restaurant_documents (id) on delete cascade,
  version integer not null check (version >= 1),
  is_current boolean not null default false,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_contract_document_versions_unique_version unique (contract_id, version),
  constraint restaurant_staff_contract_document_versions_unique_document unique (document_id)
);

create index if not exists restaurant_staff_contract_document_versions_contract_idx
  on public.restaurant_staff_contract_document_versions (contract_id, version desc);

create unique index if not exists restaurant_staff_contract_document_versions_current_idx
  on public.restaurant_staff_contract_document_versions (contract_id)
  where is_current;

alter table public.restaurant_staff_contract_document_versions enable row level security;

create policy restaurant_staff_contract_document_versions_staff_all
  on public.restaurant_staff_contract_document_versions for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_staff_contract_document_versions is
  'PDF-Versionen je Vertrag — alte Versionen bleiben erhalten.';

-- Vertragsprotokoll: zusätzliche Aktionen
alter table public.restaurant_staff_contract_log_entries
  drop constraint if exists restaurant_staff_contract_log_entries_action_check;

alter table public.restaurant_staff_contract_log_entries
  add constraint restaurant_staff_contract_log_entries_action_check
  check (
    action in (
      'created',
      'updated',
      'signed',
      'revised',
      'pdf_version'
    )
  );

-- Dokumente: Zuordnung zu Mitarbeiter (Vertrags-PDFs)
alter table public.restaurant_documents
  add column if not exists staff_id uuid references public.restaurant_staff (id) on delete set null;

create index if not exists restaurant_documents_staff_idx
  on public.restaurant_documents (restaurant_id, staff_id, created_at desc);

comment on column public.restaurant_documents.staff_id is
  'Optional: Mitarbeiter-Zuordnung (z. B. Vertrags-PDF).';
