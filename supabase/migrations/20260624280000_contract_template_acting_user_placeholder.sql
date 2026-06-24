-- Vertrag: „vertreten durch“ = eingeloggter Ersteller, nicht Restaurant-Stammdaten

update public.platform_staff_contract_template_paragraphs
set body = replace(body, '{{restaurant.vertreten_durch}}', '{{arbeitgeber.erstellt_von}}')
where body like '%{{restaurant.vertreten_durch}}%';

update public.platform_staff_contract_templates
set version = version + 1, updated_at = now()
where id in (
  select distinct template_id
  from public.platform_staff_contract_template_paragraphs
  where body like '%{{arbeitgeber.erstellt_von}}%'
);
