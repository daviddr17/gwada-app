-- Plattform-Mustervorlagen für Arbeitsverträge (pro Land + Beschäftigungsart)

create table if not exists public.platform_staff_contract_templates (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  employment_legacy_key text not null,
  name text not null,
  title text not null default '',
  legal_notice text,
  version int not null default 1,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_staff_contract_templates_country_len check (
    char_length(country_code) = 2
  ),
  constraint platform_staff_contract_templates_name_len check (
    char_length(name) between 1 and 120
  ),
  constraint platform_staff_contract_templates_title_len check (
    char_length(title) <= 500
  ),
  constraint platform_staff_contract_templates_legacy_key check (
    employment_legacy_key in (
      'full_time',
      'part_time',
      'mini_job',
      'fixed_term',
      'internship',
      'student',
      'other'
    )
  ),
  constraint platform_staff_contract_templates_country_legacy_unique unique (
    country_code,
    employment_legacy_key,
    name
  )
);

create index if not exists platform_staff_contract_templates_country_idx
  on public.platform_staff_contract_templates (country_code, sort_order, name);

create trigger platform_staff_contract_templates_set_updated_at
  before update on public.platform_staff_contract_templates
  for each row execute function public.set_updated_at();

alter table public.platform_staff_contract_templates enable row level security;

create policy platform_staff_contract_templates_superadmin_all
  on public.platform_staff_contract_templates for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

create policy platform_staff_contract_templates_authenticated_read
  on public.platform_staff_contract_templates for select
  to authenticated
  using (is_active = true);

comment on table public.platform_staff_contract_templates is
  'Plattform-Mustervorlagen für digitale Arbeitsverträge — pro Land und Beschäftigungsart (legacy_key).';

create table if not exists public.platform_staff_contract_template_paragraphs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.platform_staff_contract_templates (id) on delete cascade,
  sort_order int not null default 0,
  heading text,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_staff_contract_template_paragraphs_heading_len check (
    heading is null or char_length(heading) between 1 and 200
  )
);

create index if not exists platform_staff_contract_template_paragraphs_template_idx
  on public.platform_staff_contract_template_paragraphs (template_id, sort_order);

create trigger platform_staff_contract_template_paragraphs_set_updated_at
  before update on public.platform_staff_contract_template_paragraphs
  for each row execute function public.set_updated_at();

alter table public.platform_staff_contract_template_paragraphs enable row level security;

create policy platform_staff_contract_template_paragraphs_superadmin_all
  on public.platform_staff_contract_template_paragraphs for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

create policy platform_staff_contract_template_paragraphs_authenticated_read
  on public.platform_staff_contract_template_paragraphs for select
  to authenticated
  using (
    exists (
      select 1
      from public.platform_staff_contract_templates t
      where t.id = template_id
        and t.is_active = true
    )
  );

alter table public.restaurant_staff_contract_templates
  add column if not exists platform_template_id uuid references public.platform_staff_contract_templates (id) on delete set null,
  add column if not exists imported_platform_version int;

create index if not exists restaurant_staff_contract_templates_platform_idx
  on public.restaurant_staff_contract_templates (platform_template_id)
  where platform_template_id is not null;

-- Deutschland: Standard-Mustervorlagen (idempotent)
create or replace function public.seed_platform_de_staff_contract_templates()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_notice text := 'Mustervorlage — ersetzt keine Rechtsberatung. Bitte vor Verwendung rechtlich prüfen. Stand: Juni 2026.';
begin
  if exists (
    select 1 from public.platform_staff_contract_templates where country_code = 'DE'
  ) then
    return;
  end if;

  insert into public.platform_staff_contract_templates (
    country_code, employment_legacy_key, name, title, legal_notice, sort_order
  ) values (
    'DE', 'full_time', 'Vollzeit Standard',
    'Arbeitsvertrag — {{mitarbeiter.name}}',
    v_notice, 0
  ) returning id into v_id;
  insert into public.platform_staff_contract_template_paragraphs (template_id, sort_order, heading, body) values
    (v_id, 0, 'Vertragsparteien',
     '{{restaurant.firma}}, {{restaurant.rechtsform}}, {{restaurant.strasse}}, {{restaurant.plz}} {{restaurant.ort}} — vertreten durch {{restaurant.vertreten_durch}} (Arbeitgeber)' || E'\n\n' ||
     'und' || E'\n\n' ||
     '{{mitarbeiter.name}}, geb. {{mitarbeiter.geburtsdatum}}, {{mitarbeiter.adresse}}, {{mitarbeiter.plz}} {{mitarbeiter.ort}} (Arbeitnehmer/in)'),
    (v_id, 1, 'Beginn und Beschäftigungsart',
     'Das Arbeitsverhältnis beginnt am {{vertrag.beginn}} als {{vertrag.beschaeftigungsverhaeltnis}} in Vollzeit mit einer vereinbarten Wochenarbeitszeit von {{vertrag.wochenstunden}} Stunden.' || E'\n\n' ||
     'Ende: {{vertrag.ende}} (unbefristet, wenn leer).'),
    (v_id, 2, 'Tätigkeit',
     'Der/die Arbeitnehmer/in wird als {{mitarbeiter.position}} eingesetzt. Der Arbeitgeber kann zumutbare andere Aufgaben gleicher Art zuweisen.'),
    (v_id, 3, 'Vergütung',
     'Vergütung: {{vertrag.verguetung}}. Fälligkeit zum Monatsende, Auszahlung zum 15. des Folgemonats.'),
    (v_id, 4, 'Urlaub',
     'Urlaubsanspruch: {{vertrag.urlaubstage}} Arbeitstage pro Kalenderjahr.'),
    (v_id, 5, 'Schlussbestimmungen',
     'Änderungen und Ergänzungen bedürfen der Schriftform. Es gilt deutsches Recht.');

  insert into public.platform_staff_contract_templates (
    country_code, employment_legacy_key, name, title, legal_notice, sort_order
  ) values (
    'DE', 'part_time', 'Teilzeit Standard',
    'Teilzeit-Arbeitsvertrag — {{mitarbeiter.name}}',
    v_notice, 1
  ) returning id into v_id;
  insert into public.platform_staff_contract_template_paragraphs (template_id, sort_order, heading, body) values
    (v_id, 0, 'Vertragsparteien',
     '{{restaurant.firma}} (Arbeitgeber) und {{mitarbeiter.name}} (Arbeitnehmer/in).'),
    (v_id, 1, 'Beginn und Umfang',
     'Beginn: {{vertrag.beginn}}. Teilzeit mit {{vertrag.wochenstunden}} Wochenstunden. Beschäftigungsart: {{vertrag.beschaeftigungsverhaeltnis}}.'),
    (v_id, 2, 'Vergütung und Urlaub',
     'Vergütung: {{vertrag.verguetung}}. Urlaub: {{vertrag.urlaubstage}} Tage/Jahr.');

  insert into public.platform_staff_contract_templates (
    country_code, employment_legacy_key, name, title, legal_notice, sort_order
  ) values (
    'DE', 'mini_job', 'Minijob Standard',
    'Minijob-Arbeitsvertrag — {{mitarbeiter.name}}',
    v_notice, 2
  ) returning id into v_id;
  insert into public.platform_staff_contract_template_paragraphs (template_id, sort_order, heading, body) values
    (v_id, 0, 'Vertragsparteien',
     '{{restaurant.firma}} und {{mitarbeiter.name}}.'),
    (v_id, 1, 'Minijob',
     'Beginn: {{vertrag.beginn}}. Geringfügige Beschäftigung (Minijob). Vergütung: {{vertrag.verguetung}}. Wochenstunden nach Vereinbarung, maximal im Rahmen der Minijob-Grenze.'),
    (v_id, 2, 'Kündigung',
     'Es gelten die gesetzlichen Kündigungsfristen für Minijobs.');

  insert into public.platform_staff_contract_templates (
    country_code, employment_legacy_key, name, title, legal_notice, sort_order
  ) values (
    'DE', 'fixed_term', 'Befristet Standard',
    'Befristeter Arbeitsvertrag — {{mitarbeiter.name}}',
    v_notice, 3
  ) returning id into v_id;
  insert into public.platform_staff_contract_template_paragraphs (template_id, sort_order, heading, body) values
    (v_id, 0, 'Vertragsparteien',
     '{{restaurant.firma}} und {{mitarbeiter.name}}.'),
    (v_id, 1, 'Befristung',
     'Beginn: {{vertrag.beginn}}. Das Arbeitsverhältnis endet am {{vertrag.ende}} ohne Kündigung. Befristungsgrund gemäß § 14 TzBfG (sachlicher Grund) wird gesondert dokumentiert.'),
    (v_id, 2, 'Vergütung',
     'Vergütung: {{vertrag.verguetung}}. Urlaub: {{vertrag.urlaubstage}} Tage/Jahr.');

  insert into public.platform_staff_contract_templates (
    country_code, employment_legacy_key, name, title, legal_notice, sort_order
  ) values (
    'DE', 'internship', 'Praktikum Standard',
    'Praktikumsvertrag — {{mitarbeiter.name}}',
    v_notice, 4
  ) returning id into v_id;
  insert into public.platform_staff_contract_template_paragraphs (template_id, sort_order, heading, body) values
    (v_id, 0, 'Vertragsparteien',
     '{{restaurant.firma}} und {{mitarbeiter.name}}.'),
    (v_id, 1, 'Praktikum',
     'Beginn: {{vertrag.beginn}}, Ende: {{vertrag.ende}}. Praktikum zur {{mitarbeiter.position}}. Vergütung/Praktikumsvergütung: {{vertrag.verguetung}}.'),
    (v_id, 2, 'Versicherung',
     'Hinweis auf Unfallversicherung und ggf. Sozialversicherung je nach Praktikumsart.');

  insert into public.platform_staff_contract_templates (
    country_code, employment_legacy_key, name, title, legal_notice, sort_order
  ) values (
    'DE', 'student', 'Werkstudent Standard',
    'Werkstudentenvertrag — {{mitarbeiter.name}}',
    v_notice, 5
  ) returning id into v_id;
  insert into public.platform_staff_contract_template_paragraphs (template_id, sort_order, heading, body) values
    (v_id, 0, 'Vertragsparteien',
     '{{restaurant.firma}} und {{mitarbeiter.name}}.'),
    (v_id, 1, 'Werkstudent',
     'Beginn: {{vertrag.beginn}}. Werkstudententätigkeit max. 20 Std./Woche in Vorlesungszeiten. Vergütung: {{vertrag.verguetung}}.'),
    (v_id, 2, 'Status',
     'Der/die Arbeitnehmer/in bestätigt die immatrikulierte Studentin/den immatrikulierten Studenten.');
end;
$$;

select public.seed_platform_de_staff_contract_templates();

revoke all on function public.seed_platform_de_staff_contract_templates() from public;
