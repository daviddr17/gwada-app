-- Ausführliche DE-Vollzeit-Mustervorlage (Plattform-Bibliothek)

do $$
declare
  v_id uuid;
  v_notice text :=
    'Mustervorlage — ersetzt keine Rechtsberatung. Bitte vor Verwendung durch Fachanwalt oder Steuerberater prüfen und an Betrieb, Tarifbindung und Besonderheiten anpassen. Stand: Juni 2026.';
begin
  select id into v_id
  from public.platform_staff_contract_templates
  where country_code = 'DE'
    and employment_legacy_key = 'full_time'
    and name = 'Vollzeit Standard'
  limit 1;

  if v_id is null then
    return;
  end if;

  update public.platform_staff_contract_templates
  set
    title = 'Arbeitsvertrag — {{mitarbeiter.name}}',
    legal_notice = v_notice,
    version = version + 1,
    updated_at = now()
  where id = v_id;

  delete from public.platform_staff_contract_template_paragraphs
  where template_id = v_id;

  insert into public.platform_staff_contract_template_paragraphs (
    template_id, sort_order, heading, body
  ) values
    (v_id, 0, 'Vertragsparteien',
     '{{restaurant.firma}}' || E'\n' ||
     '{{restaurant.rechtsform}}' || E'\n' ||
     '{{restaurant.strasse}}, {{restaurant.plz}} {{restaurant.ort}}' || E'\n' ||
     'Handelsregister: {{restaurant.handelsregister}}' || E'\n' ||
     'USt-IdNr.: {{restaurant.ust_id}}' || E'\n' ||
     'Telefon: {{restaurant.telefon}}' || E'\n\n' ||
     'vertreten durch {{restaurant.vertreten_durch}}' || E'\n' ||
     '— nachstehend „Arbeitgeber“ —' || E'\n\n' ||
     'und' || E'\n\n' ||
     '{{mitarbeiter.name}}' || E'\n' ||
     'geboren am {{mitarbeiter.geburtsdatum}}' || E'\n' ||
     'Staatsangehörigkeit: {{mitarbeiter.nationalitaet}}' || E'\n' ||
     '{{mitarbeiter.adresse}}, {{mitarbeiter.plz}} {{mitarbeiter.ort}}' || E'\n' ||
     'E-Mail: {{mitarbeiter.email}} · Telefon: {{mitarbeiter.telefon}}' || E'\n' ||
     '— nachstehend „Arbeitnehmer/in“ —' || E'\n\n' ||
     'Arbeitgeber und Arbeitnehmer/in schließen nachfolgenden Arbeitsvertrag.'),
    (v_id, 1, '§ 1 Beginn und Dauer',
     'Das Arbeitsverhältnis beginnt am {{vertrag.beginn}}.' || E'\n\n' ||
     'Es wird als {{vertrag.beschaeftigungsverhaeltnis}} in Vollzeit begründet.' || E'\n\n' ||
     'Ende des Arbeitsverhältnisses: {{vertrag.ende}} (leer = unbefristet).'),
    (v_id, 2, '§ 2 Probezeit',
     'Die ersten sechs Monate ab Arbeitsbeginn gelten als Probezeit, sofern nicht kürzere gesetzliche oder tarifliche Regelungen gelten.' || E'\n\n' ||
     'Während der Probezeit kann das Arbeitsverhältnis mit einer Frist von zwei Wochen gekündigt werden.'),
    (v_id, 3, '§ 3 Tätigkeit und Arbeitsort',
     'Der/die Arbeitnehmer/in wird als {{mitarbeiter.position}} eingesetzt.' || E'\n\n' ||
     'Der Arbeitgeber kann dem/der Arbeitnehmer/in zumutbare andere Aufgaben gleicher Art und gleichen Wertungsniveaus zuweisen.' || E'\n\n' ||
     'Arbeitsort ist der Betrieb des Arbeitgebers, {{restaurant.strasse}}, {{restaurant.plz}} {{restaurant.ort}}, sowie betrieblich erforderliche Einsätze (z. B. Veranstaltungen, Catering).'),
    (v_id, 4, '§ 4 Arbeitszeit',
     'Die vereinbarte regelmäßige wöchentliche Arbeitszeit beträgt {{vertrag.wochenstunden}} Stunden.' || E'\n\n' ||
     'Beginn, Ende und Pausen der täglichen Arbeitszeit richten sich nach dem Dienstplan des Arbeitgebers unter Beachtung der gesetzlichen Höchstarbeitszeit, Ruhezeiten und gesetzlichen Feiertage.' || E'\n\n' ||
     'Überstunden sind nur nach vorheriger Anordnung oder ausdrücklicher Genehmigung des Arbeitgebers zu leisten, soweit nicht zwingende betriebliche Gründe entgegenstehen.'),
    (v_id, 5, '§ 5 Vergütung',
     'Der/die Arbeitnehmer/in erhält eine Vergütung von {{vertrag.verguetung}}.' || E'\n\n' ||
     'Bei Stundenlohn: {{vertrag.stundenlohn}} EUR brutto je Arbeitsstunde. Bei Festgehalt: {{vertrag.festgehalt}} EUR brutto monatlich.' || E'\n\n' ||
     'Die Vergütung ist zum Ende eines Kalendermonats fällig und wird spätestens zum 15. des Folgemonats auf ein vom/von der Arbeitnehmer/in benanntes Konto überwiesen, sofern nichts Abweichendes vereinbart ist.' || E'\n\n' ||
     'Mit der Vergütung sind eventuell anfallende Überstunden bis zu einem Umfang von 10 % der vereinbarten Arbeitszeit abgegolten, soweit gesetzlich zulässig.'),
    (v_id, 6, '§ 6 Zuschläge, Trinkgeld und Sachbezüge',
     'Gesetzliche Zuschläge (z. B. für Nacht-, Sonn- oder Feiertagsarbeit) werden nach Maßgabe des Gesetzes und ggf. anwendbarer Tarifverträge gezahlt.' || E'\n\n' ||
     'Trinkgeld, das Gäste freiwillig und ohne Anspruch auf Weitergabe leisten, gehört dem/der Arbeitnehmer/in, sofern im Betrieb nichts Abweichendes in gesetzlich zulässiger Weise geregelt ist.'),
    (v_id, 7, '§ 7 Urlaub',
     'Der/die Arbeitnehmer/in hat Anspruch auf {{vertrag.urlaubstage}} Arbeitstage Erholungsurlaub pro Kalenderjahr bei einer Sechs-Tage-Woche.' || E'\n\n' ||
     'Der Urlaub wird nach betrieblichen Erfordernissen und unter Berücksichtigung der Urlaubswünsche des/der Arbeitnehmers/in festgelegt.' || E'\n\n' ||
     'Bei Beendigung des Arbeitsverhältnisses ist nicht genommener Urlaub abzugelten, soweit er nicht gewährt werden kann.'),
    (v_id, 8, '§ 8 Entgeltfortzahlung im Krankheitsfall',
     'Im Krankheitsfall besteht Anspruch auf Entgeltfortzahlung nach den gesetzlichen Vorschriften (§ 3 Entgeltfortzahlungsgesetz), sofern die Voraussetzungen erfüllt sind.' || E'\n\n' ||
     'Der/die Arbeitnehmer/in hat den Arbeitgeber unverzüglich über Arbeitsunfähigkeit zu informieren und spätestens am dritten Kalendtag eine ärztliche Arbeitsunfähigkeitsbescheinigung vorzulegen, sofern nichts anderes vereinbart ist.'),
    (v_id, 9, '§ 9 Geheimhaltung und Datenschutz',
     'Der/die Arbeitnehmer/in verpflichtet sich, Betriebs- und Geschäftsgeheimnisse sowie personenbezogene Daten von Gästen, Mitarbeitenden und Geschäftspartnern vertraulich zu behandeln — auch nach Beendigung des Arbeitsverhältnisses.' || E'\n\n' ||
     'Die Verarbeitung personenbezogener Daten erfolgt im Rahmen der gesetzlichen Bestimmungen und der betrieblichen Datenschutzinformation.'),
    (v_id, 10, '§ 10 Nebenbeschäftigung',
     'Jede entgeltliche oder das Arbeitsverhältnis beeinträchtigende Nebenbeschäftigung bedarf der vorherigen schriftlichen Zustimmung des Arbeitgebers. Der/die Arbeitnehmer/in teilt beantragte Nebenbeschäftigungen mit.'),
    (v_id, 11, '§ 11 Betriebliche Altersvorsorge',
     'Der Arbeitgeber weist darauf hin, dass dem/der Arbeitnehmer/in die Möglichkeit der betrieblichen Altersvorsorge nach den gesetzlichen Vorschriften eröffnet wird. Einzelheiten werden gesondert mitgeteilt.'),
    (v_id, 12, '§ 12 Tarifverträge und Betriebsvereinbarungen',
     'Soweit für den Betrieb Tarifverträge oder Betriebsvereinbarungen gelten, gehen deren Regelungen den vorliegenden Vertrag vor, sofern sie für das Arbeitsverhältnis anwendbar sind.'),
    (v_id, 13, '§ 13 Kündigung',
     'Nach Ablauf der Probezeit gelten die gesetzlichen Kündigungsfristen des § 622 BGB, sofern nicht tariflich abweichende Regelungen Anwendung finden.' || E'\n\n' ||
     'Kündigungen bedürfen der Schriftform. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.'),
    (v_id, 14, '§ 14 Arbeitsmittel, Hygiene und Arbeitsschutz',
     'Der Arbeitgeber stellt die für die Tätigkeit erforderlichen Arbeitsmittel. Vorgaben zu Hygiene, Lebensmittelsicherheit (HACCP) und Arbeitsschutz sind einzuhalten.' || E'\n\n' ||
     'Vom Arbeitgeber gestellte Arbeitskleidung und Betriebsmittel sind pfleglich zu behandeln und bei Beendigung des Arbeitsverhältnisses zurückzugeben, soweit Eigentum des Arbeitgebers.'),
    (v_id, 15, '§ 15 Nebenpflichten',
     'Der/die Arbeitnehmer/in hat die betrieblichen Anweisungen zu befolgen, sorgfältig und gewissenhaft zu arbeiten und das Ansehen des Arbeitgebers nicht zu schädigen.'),
    (v_id, 16, '§ 16 Schlussbestimmungen',
     'Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Mündliche Nebenabreden bestehen nicht.' || E'\n\n' ||
     'Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt der Vertrag im Übrigen wirksam; anstelle der unwirksamen Regelung gilt eine wirksame Regelung, die dem wirtschaftlichen Zweck am nächsten kommt.' || E'\n\n' ||
     'Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist — soweit gesetzlich zulässig — der Sitz des Arbeitgebers in {{restaurant.ort}}.');
end;
$$;
