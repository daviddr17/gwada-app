/**
 * Mustertext für Gast-Reservierungen (DSGVO / BGB-orientiert).
 * Vor Livegang vom Restaurant und ggf. einer Rechtsanwältin prüfen lassen.
 */

export type ReservationBookingTermsSection = {
  title: string;
  paragraphs: readonly string[];
};

export function reservationBookingTermsSections(
  restaurantName: string,
): ReservationBookingTermsSection[] {
  const name = restaurantName.trim() || "das Restaurant";

  return [
    {
      title: "1. Geltungsbereich",
      paragraphs: [
        `Diese Bedingungen regeln die Online-Tischreservierung bei ${name} („Restaurant“) über das eingebettete Reservierungsformular. Mit Absenden der Reservierung erklären Sie sich mit diesen Bedingungen einverstanden.`,
        "Vertragspartner ist das Restaurant als Anbieter der Gastronomie-Leistung; technische Bereitstellung des Formulars kann über einen Auftragsverarbeiter erfolgen.",
      ],
    },
    {
      title: "2. Reservierung und Vertragsschluss",
      paragraphs: [
        "Ihre Anfrage stellt ein Angebot auf Abschluss eines Gastronomievertrags (Tischreservierung) zu den angegebenen Daten dar. Der Vertrag kommt zustande, wenn das Restaurant die Reservierung bestätigt (z. B. per E-Mail, WhatsApp oder telefonisch) oder die Reservierung in seinem System als bestätigt führt.",
        "Bis zur Bestätigung kann das Restaurant die Reservierung ablehnen, insbesondere bei Ausgebuchtsein, bei Veranstaltungen oder bei fehlenden Angaben. Änderungen und Stornierungen sind über die im Formular mitgeteilte Reservierungsnummer und PIN möglich, soweit das Restaurant dies vorsieht.",
      ],
    },
    {
      title: "3. Pflichten des Gastes",
      paragraphs: [
        "Sie geben wahrheitsgemäße Angaben (Name, Kontakt, Personenzahl, Termin) an und erscheinen zum reservierten Zeitpunkt oder sagen rechtzeitig ab.",
        "Bei wiederholten No-Shows oder groben Verstößen kann das Restaurant künftige Reservierungen ablehnen.",
      ],
    },
    {
      title: "4. Datenschutz (DSGVO)",
      paragraphs: [
        `Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist ${name} in seiner Eigenschaft als Betreiber der Reservierung. Kontaktdaten des Verantwortlichen (Anschrift, E-Mail) entnehmen Sie den Angaben des Restaurants vor Ort oder auf dessen Website.`,
        "Rechtsgrundlagen der Verarbeitung sind insbesondere Art. 6 Abs. 1 lit. b DSGVO (Vertrag bzw. vorvertragliche Maßnahmen zur Reservierung), Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, z. B. in Benachrichtigungen per E-Mail/WhatsApp, sofern Sie diese aktivieren) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an ordnungsgemäßer Gästeverwaltung und Kommunikation).",
        "Verarbeitete Daten können sein: Vor- und Nachname, Telefonnummer, E-Mail-Adresse, Personenzahl, gewünschter Termin (Datum/Uhrzeit), Reservierungsnummer und PIN, technische Metadaten (z. B. Zeitpunkt der Übermittlung), sowie Einstellungen zu Benachrichtigungen.",
        "Zweck der Verarbeitung: Entgegennahme und Verwaltung Ihrer Reservierung, Zuordnung zu Tischen, Kontaktaufnahme bei Rückfragen, Versand von Statusnachrichten (Eingang, Bestätigung, Erinnerung, Änderung, Stornierung), Erfüllung gesetzlicher Aufbewahrungspflichten und Missbrauchsprävention.",
        "Speicherdauer: Reservierungsdaten werden nur so lange gespeichert, wie es für die Abwicklung, Nachweisführung und gesetzliche Aufbewahrungsfristen erforderlich ist; danach Löschung oder Anonymisierung, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",
        "Empfänger: Daten werden im Rahmen des Reservierungssystems verarbeitet; ggf. Auftragsverarbeiter (Hosting, E-Mail-/WhatsApp-Versand) mit vertraglichen Auftragsverarbeitungsverträgen gemäß Art. 28 DSGVO. Eine Übermittlung in Drittländer erfolgt nur bei Vorliegen der Voraussetzungen der Art. 44 ff. DSGVO.",
        "Ihre Rechte: Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit, Widerspruch (insbesondere gegen Verarbeitung auf Basis berechtigter Interessen) und Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft. Beschwerderecht bei einer Aufsichtsbehörde (z. B. für Deutschland die für Sie zuständige Landesbehörde).",
        "Sofern die Verarbeitung auf Einwilligung beruht, ist die Einwilligung freiwillig; für die Reservierung sind jedoch die für den Vertrag erforderlichen Angaben und die Annahme dieser Bedingungen notwendig.",
      ],
    },
    {
      title: "5. Benachrichtigungen",
      paragraphs: [
        "Wenn Sie E-Mail- oder WhatsApp-Benachrichtigungen aktivieren, willigen Sie in die Zusendung reservierungsbezogener Nachrichten über den gewählten Kanal ein. Sie können die Kanäle im Formular wählen; mindestens ein Kanal muss aktiv sein, damit Sie über Statusänderungen informiert werden können.",
        "Sie können Einwilligungen jederzeit mit Wirkung für die Zukunft widerrufen (z. B. durch Abmeldung oder Mitteilung an das Restaurant).",
      ],
    },
    {
      title: "6. Stornierung und No-Show",
      paragraphs: [
        "Stornierungen und Änderungen richten sich nach den Regeln des Restaurants; nutzen Sie hierfür die im Formular bereitgestellten Funktionen (Reservierungsnummer und PIN), sofern angeboten.",
        "Bei unentschuldigtem Ausbleiben (No-Show) kann das Restaurant Schadensersatz verlangen, soweit dem nicht gesetzliche Beschränkungen entgegenstehen.",
      ],
    },
    {
      title: "7. Haftung",
      paragraphs: [
        "Das Restaurant haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Im Übrigen haftet das Restaurant nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf den vorhersehbaren, typischerweise eintretenden Schaden.",
        "Für Störungen des Online-Formulars, die nicht im Einflussbereich des Restaurants liegen, wird keine Haftung übernommen, soweit gesetzlich zulässig.",
      ],
    },
    {
      title: "8. Schlussbestimmungen",
      paragraphs: [
        "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts, sofern dem keine zwingenden Verbraucherschutzvorschriften Ihres Wohnsitzstaates entgegenstehen.",
        "Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt.",
        "Stand: Mai 2026. Das Restaurant kann diese Bedingungen anpassen; maßgeblich ist die zum Zeitpunkt Ihrer Reservierung einsehbare Fassung.",
      ],
    },
  ] as const;
}
