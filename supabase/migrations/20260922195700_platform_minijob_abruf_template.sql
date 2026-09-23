-- DE Minijob-Plattformvorlage: befristet + geringfügig + Arbeit auf Abruf
-- (Inhalt angelehnt an „Arbeitsvertrag Minijob Vorlage 2025“, mit Platzhaltern)

do $$
declare
  v_id uuid;
  v_notice text :=
    'Mustervorlage — ersetzt keine Rechtsberatung. Bitte vor Verwendung rechtlich prüfen. Stand: September 2026.';
begin
  select id
    into v_id
  from public.platform_staff_contract_templates
  where country_code = 'DE'
    and employment_legacy_key = 'mini_job'
    and name = 'Minijob Standard'
  limit 1;

  if v_id is null then
    insert into public.platform_staff_contract_templates (
      country_code,
      employment_legacy_key,
      name,
      title,
      legal_notice,
      version,
      sort_order,
      is_active
    ) values (
      'DE',
      'mini_job',
      'Minijob Standard',
      'Befristeter Arbeitsvertrag — geringfügige Beschäftigung (Minijob) und Arbeit auf Abruf — {{mitarbeiter.name}}',
      v_notice,
      1,
      2,
      true
    )
    returning id into v_id;
  else
    update public.platform_staff_contract_templates
    set
      title =
        'Befristeter Arbeitsvertrag — geringfügige Beschäftigung (Minijob) und Arbeit auf Abruf — {{mitarbeiter.name}}',
      legal_notice = v_notice,
      version = version + 1,
      is_active = true,
      updated_at = now()
    where id = v_id;
  end if;

  delete from public.platform_staff_contract_template_paragraphs
  where template_id = v_id;

  insert into public.platform_staff_contract_template_paragraphs (
    template_id, sort_order, heading, body
  ) values
    (
      v_id,
      0,
      'Vertragsparteien',
      '{{restaurant.firma}}' || E'\n' ||
      '{{restaurant.strasse}}' || E'\n' ||
      '{{restaurant.plz}} {{restaurant.ort}}' || E'\n' ||
      '– nachfolgend „Arbeitgeber“ genannt –' || E'\n\n' ||
      'und' || E'\n\n' ||
      '{{mitarbeiter.name}}' || E'\n' ||
      '{{mitarbeiter.adresse}}' || E'\n' ||
      '{{mitarbeiter.plz}} {{mitarbeiter.ort}}' || E'\n' ||
      '{{mitarbeiter.land}}' || E'\n' ||
      '– nachfolgend „Arbeitnehmer“ genannt –' || E'\n\n' ||
      'wird folgender Arbeitsvertrag geschlossen:'
    ),
    (
      v_id,
      1,
      '§ 1 Beginn und Ende des Arbeitsverhältnisses',
      'Der Arbeitgeber führt einen wetterabhängigen Saisonbetrieb mit überwiegender Bewirtschaftungsfläche im nicht überdachten Außenbereich.' || E'\n\n' ||
      'Der Arbeitnehmer wird für die Zeit vom {{vertrag.beginn}} und bis spätestens {{vertrag.ende}} eingestellt.' || E'\n\n' ||
      'Das Arbeitsverhältnis kann auch während des Bestehens gemäß der gesetzlichen Vorschriften gekündigt werden.'
    ),
    (
      v_id,
      2,
      '§ 2 Probezeit',
      'Die Vertragsparteien vereinbaren eine Probezeit von vier Wochen. Während der Probezeit kann das Arbeitsverhältnis mit einer Frist von zwei Wochen gekündigt werden.'
    ),
    (
      v_id,
      3,
      '§ 3 Tätigkeit',
      'Der Arbeitnehmer wird als {{mitarbeiter.position}} eingestellt.' || E'\n\n' ||
      'Er verpflichtet sich, auch andere Arbeiten auszuführen – auch an einem anderen Ort –, die seinen Vorkenntnissen und Fähigkeiten entsprechen. Dies gilt, soweit dies bei Abwägung der Interessen des Arbeitgebers und des Arbeitnehmers zumutbar und nicht mit einer Lohnminderung verbunden ist.'
    ),
    (
      v_id,
      4,
      '§ 4 Arbeitsvergütung',
      'Der Arbeitnehmer erhält einen Stundenlohn von {{vertrag.stundenlohn}}.' || E'\n\n' ||
      'Abgerechnet und ausgezahlt werden jeweils bis zum 10. des Folgemonats ausschließlich die tatsächlich geleisteten Arbeitsstunden.' || E'\n\n' ||
      'Es besteht kein Anspruch auf eine Mindestvergütung, Garantievergütung oder Entgelt für nicht abgerufene bzw. nicht geleistete Stunden. Bei 0 geleisteten Stunden in einem Abrechnungszeitraum beträgt die Vergütung 0 €.' || E'\n\n' ||
      'Der Arbeitnehmer beauftragt hiermit den Arbeitgeber, sich im Rahmen der geringfügigen Beschäftigung von der Rentenversicherungspflicht nach § 6 Abs. 1b SGB VI mit dem Tage der Gültigkeit dieses Arbeitsvertrages befreien zu lassen.'
    ),
    (
      v_id,
      5,
      '§ 5 Arbeitszeit auf Abruf',
      'Die geplante, durchschnittliche regelmäßige Arbeitszeit wird im Hinblick auf das wetterabhängige Saisongeschäft variabel wie folgt gestaltet:' || E'\n\n' ||
      'Die wöchentliche Arbeitszeit beträgt bis zu {{vertrag.wochenstunden}} Stunden (Höchstarbeitszeit).' || E'\n\n' ||
      'Der Arbeitgeber kann die Arbeitsleistung des Arbeitnehmers entsprechend dem betrieblichen Bedarf (wetterabhängiges Saisongeschäft) auf Abruf in Anspruch nehmen.' || E'\n\n' ||
      'Beginn und Ende der Arbeitszeit richten sich nach der betrieblichen Einteilung und dem Bedarf und erfolgen auf Abruf durch den Arbeitgeber.' || E'\n\n' ||
      'Der Arbeitnehmer ist nur zur Arbeitsleistung verpflichtet, wenn der Arbeitgeber ihm die Lage der Arbeitszeit mindestens 4 Tage im Voraus mitteilt.' || E'\n\n' ||
      'Jeder einzelne Arbeitseinsatz dauert mindestens 3 zusammenhängende Stunden.' || E'\n\n' ||
      'Es besteht kein Anspruch auf Abruf einer bestimmten Stundenzahl. Nicht abgerufene Stunden werden nicht vergütet.'
    ),
    (
      v_id,
      6,
      '§ 6 Verschwiegenheitspflicht',
      'Der Arbeitnehmer verpflichtet sich, während der Dauer des Arbeitsverhältnisses und auch nach Ausscheiden, über alle Betriebs- und Geschäftsgeheimnisse Stillschweigen zu bewahren.'
    ),
    (
      v_id,
      7,
      '§ 7 Weitergehende Beschäftigungen',
      'Der Arbeitnehmer verpflichtet sich, jede Aufnahme einer weitergehenden Beschäftigung dem Arbeitgeber unverzüglich schriftlich mitzuteilen. Dies gilt für sämtliche Beschäftigungen, unabhängig von der Höhe des Verdienstes oder deren zeitlichem Umfang.'
    ),
    (
      v_id,
      8,
      '§ 8 Verfall-/Ausschlussfristen',
      'Die Vertragsparteien müssen Ansprüche aus dem Arbeitsverhältnis innerhalb von drei Monaten nach ihrer Fälligkeit schriftlich geltend machen und im Falle der Ablehnung oder in Ermangelung einer Reaktion durch die Gegenseite innerhalb von weiteren drei Monaten einklagen. Für Ansprüche aus unerlaubter Handlung verbleibt es bei der gesetzlichen Regelung.'
    ),
    (
      v_id,
      9,
      '§ 9 Vertragsänderungen und Nebenabreden; Salvatorische Klausel',
      'Aus dem reinen einseitigen Verhalten des Arbeitgebers erwachsen dem Arbeitnehmer keine vertraglichen Rechtsansprüche, sofern nicht eine schriftliche einvernehmliche Vertragsänderung vorliegt (Ausschluss der betrieblichen Übung).' || E'\n\n' ||
      'Jedwede Vertragsänderungen bedürfen der Schriftform, auch die Aufhebung des Schriftformerfordernisses.' || E'\n\n' ||
      'Sollten einzelne Bestimmungen dieses Vertrages unwirksam sein oder werden, wird hierdurch die Wirksamkeit des Vertrages im Übrigen nicht berührt. Es soll eine Regelung gelten, welche dem wirtschaftlich gewollten am nächsten kommt.' || E'\n\n' ||
      'Der Arbeitnehmer verpflichtet sich, dem Arbeitgeber unverzüglich über Veränderungen der persönlichen Verhältnisse wie Familienstand, Kinderzahl und Adresse Mitteilung zu machen.'
    ),
    (
      v_id,
      10,
      '§ 10 Zusätzliche Hinweise',
      'Zur Aufrechterhaltung ungekürzter Ansprüche auf Arbeitslosengeld ist der Arbeitnehmer verpflichtet, sich rechtzeitig vor Ablauf des Vertragsverhältnisses persönlich bei der Agentur für Arbeit arbeitssuchend zu melden.' || E'\n\n' ||
      '{{restaurant.ort}}, den {{vertrag.beginn}}'
    );
end;
$$;
