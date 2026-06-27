-- Wareneingang entfällt (Lieferung läuft über Modul Bestand). Kein Legacy — Dev-only bisher.

delete from public.restaurant_compliance_records
where checklist_id in (
  select id
  from public.restaurant_compliance_checklists
  where category = 'goods_receipt'
);

delete from public.restaurant_compliance_checklists
where category = 'goods_receipt';

delete from public.platform_compliance_checklist_templates
where category = 'goods_receipt'
   or name = 'Wareneingang';

alter table public.restaurant_compliance_checklists
  drop constraint if exists restaurant_compliance_checklists_category_check;

alter table public.restaurant_compliance_checklists
  add constraint restaurant_compliance_checklists_category_check check (
    category in (
      'temperature',
      'cleaning',
      'hot_hold',
      'cooking',
      'other'
    )
  );

alter table public.restaurant_compliance_checklists
  drop constraint if exists restaurant_compliance_checklists_frequency_check;

alter table public.restaurant_compliance_checklists
  add constraint restaurant_compliance_checklists_frequency_check check (
    frequency in ('daily', 'weekly', 'monthly', 'ad_hoc')
  );

alter table public.platform_compliance_checklist_templates
  drop constraint if exists platform_compliance_checklist_templates_category_check;

alter table public.platform_compliance_checklist_templates
  add constraint platform_compliance_checklist_templates_category_check check (
    category in (
      'temperature',
      'cleaning',
      'hot_hold',
      'cooking',
      'other'
    )
  );

alter table public.platform_compliance_checklist_templates
  drop constraint if exists platform_compliance_checklist_templates_frequency_check;

alter table public.platform_compliance_checklist_templates
  add constraint platform_compliance_checklist_templates_frequency_check check (
    frequency in ('daily', 'weekly', 'monthly', 'ad_hoc')
  );

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

revoke all on function public.seed_platform_de_compliance_checklist_templates() from public;
