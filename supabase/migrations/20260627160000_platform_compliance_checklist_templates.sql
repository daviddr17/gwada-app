-- Plattform-Bibliothek für Eigenkontrolle-Checklisten (Superadmin → Restaurant-Import)

create table public.platform_compliance_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  name text not null,
  description text,
  category text not null,
  frequency text not null,
  items jsonb not null default '[]'::jsonb,
  show_on_display boolean not null default true,
  version integer not null default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_compliance_checklist_templates_country_len check (
    char_length(country_code) = 2
  ),
  constraint platform_compliance_checklist_templates_name_len check (
    char_length(trim(name)) between 1 and 200
  ),
  constraint platform_compliance_checklist_templates_category_check check (
    category in (
      'temperature',
      'cleaning',
      'hot_hold',
      'cooking',
      'other'
    )
  ),
  constraint platform_compliance_checklist_templates_frequency_check check (
    frequency in ('daily', 'weekly', 'monthly', 'ad_hoc')
  )
);

create index platform_compliance_checklist_templates_country_idx
  on public.platform_compliance_checklist_templates (country_code, sort_order, name);

create trigger platform_compliance_checklist_templates_set_updated_at
  before update on public.platform_compliance_checklist_templates
  for each row execute function public.set_updated_at();

alter table public.platform_compliance_checklist_templates enable row level security;

create policy platform_compliance_checklist_templates_superadmin_all
  on public.platform_compliance_checklist_templates for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

create policy platform_compliance_checklist_templates_authenticated_read
  on public.platform_compliance_checklist_templates for select
  to authenticated
  using (is_active = true or public.auth_is_superadmin());

comment on table public.platform_compliance_checklist_templates is
  'Zentrale HACCP-Checklistenvorlagen — Restaurants importieren Kopien.';

alter table public.restaurant_compliance_checklists
  add column if not exists platform_template_id uuid references public.platform_compliance_checklist_templates (id) on delete set null,
  add column if not exists imported_platform_version integer;

create index restaurant_compliance_checklists_platform_idx
  on public.restaurant_compliance_checklists (platform_template_id)
  where platform_template_id is not null;

create or replace function public.seed_platform_de_compliance_checklist_templates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.platform_compliance_checklist_templates where country_code = 'DE'
  ) then
    return;
  end if;

  insert into public.platform_compliance_checklist_templates (
    country_code,
    name,
    description,
    category,
    frequency,
    items,
    show_on_display,
    sort_order
  )
  values
    (
      'DE',
      'Kühl- & Tiefkühltemperaturen',
      'Tägliche Kontrolle aller Kühl- und Tiefkühleinrichtungen — mindestens einmal pro Tag.',
      'temperature',
      'daily',
      '[
        {"id":"seed-temp-fridge","label":"Kühlschrank / Kühltruhe","fieldType":"temperature","maxValue":7,"required":true},
        {"id":"seed-temp-freezer","label":"Tiefkühlgerät","fieldType":"temperature","maxValue":-18,"required":true}
      ]'::jsonb,
      true,
      0
    ),
    (
      'DE',
      'Reinigung Küche (Tagesplan)',
      'Standard-Reinigungsaufgaben für Küchenbereich und Arbeitsflächen.',
      'cleaning',
      'daily',
      '[
        {"id":"seed-clean-1","label":"Arbeitsflächen gereinigt","fieldType":"boolean","required":true},
        {"id":"seed-clean-2","label":"Fußboden Küche gereinigt","fieldType":"boolean","required":true},
        {"id":"seed-clean-3","label":"Abfallbehälter geleert / gereinigt","fieldType":"boolean","required":true}
      ]'::jsonb,
      true,
      1
    ),
    (
      'DE',
      'Warmhalten / Ausgabe',
      'Heißhalte-Temperaturen bei der Speisenausgabe.',
      'hot_hold',
      'daily',
      '[
        {"id":"seed-hot-1","label":"Ausgabe-Temperatur (°C)","fieldType":"temperature","minValue":65,"required":true}
      ]'::jsonb,
      true,
      2
    ),
    (
      'DE',
      'Kerntemperatur Garen',
      'Stichprobe bei Geflügel, Hackfleisch, Fisch — pro Charge oder Batch.',
      'cooking',
      'ad_hoc',
      '[
        {"id":"seed-cook-1","label":"Gericht / Charge","fieldType":"text","required":true},
        {"id":"seed-cook-2","label":"Kerntemperatur (°C)","fieldType":"temperature","minValue":72,"required":true}
      ]'::jsonb,
      false,
      3
    );
end;
$$;

select public.seed_platform_de_compliance_checklist_templates();

revoke all on function public.seed_platform_de_compliance_checklist_templates() from public;
