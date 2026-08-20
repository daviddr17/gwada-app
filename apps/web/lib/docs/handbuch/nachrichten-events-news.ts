import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const nachrichtenGuide: UserGuidePage = {
  slug: "nachrichten",
  title: "Nachrichten & Kontakte",
  description:
    "Multi-Channel-Inbox, Kontaktverwaltung, Tags und Kanal-Einstellungen.",
  intro: [
    "Nachrichten ist dein zentraler Posteingang: WhatsApp, E-Mail, Facebook, Instagram und der Gwada-eigene Chat — alles in einer Inbox. Dazu gehört eine Kontaktliste mit allen Gästen, Lieferanten und Anfragen.",
    "Jede Konversation ist einem Kontakt zugeordnet (oder wird beim Antworten verknüpft). Ungelesene Nachrichten erscheinen im Dashboard unter Heute → Post und Aufmerk.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Nachrichten", "Inbox — alle Konversationen"],
          ["Kontakte", "Adressbuch mit Stammdaten, Tags, Timeline"],
          ["Statistiken", "Antwortzeiten, Volumen pro Kanal"],
          ["Export", "Kontakte als Datei exportieren"],
          ["Einstellungen", "Auto-Verknüpfung, Kanal-Optionen"],
        ],
      },
    },
    {
      heading: "Plattform-Chips (Nachrichten)",
      body: "Horizontale Chips filtern die Inbox nach Kanal — kein Bottom Sheet:",
      table: {
        headers: ["Chip", "Bedeutung"],
        rows: [
          ["Alle", "Konversationen über alle Kanäle"],
          ["WhatsApp", "Nur WhatsApp-Chats (WAHA-Integration nötig)"],
          ["E-Mail", "Nur E-Mail-Konversationen"],
          ["Facebook", "Facebook-Messenger"],
          ["Instagram", "Instagram-Direct"],
        ],
      },
    },
    {
      heading: "Lesefilter-Chips",
      table: {
        headers: ["Chip", "Bedeutung"],
        rows: [
          ["Alle", "Gelesen und ungelesen"],
          ["Ungelesen", "Chip „Neu“ (am Kanal noch offen) und „In Gwada offen“ (am Handy/Mail schon gelesen)"],
          ["Gelesen", "Bereits bearbeitete Chats"],
        ],
      },
    },
    {
      heading: "Kontakte — Plattform-Chips",
      table: {
        headers: ["Chip", "Bedeutung"],
        rows: [
          ["Alle", "Alle Kontakte"],
          ["Gwada", "Kontakte aus Gwada-Chat / Profil"],
          ["Lexware", "Mit Lexware synchronisierte Geschäftskontakte"],
        ],
      },
    },
    {
      heading: "Buttons und Aktionen",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Neuer Kontakt", "Kontakt manuell anlegen"],
          ["Filter (Kontakte)", "Bottom Sheet: Tag-Filter (Alle / Ohne Tag / einzelne Tags)"],
          ["Kontakt aus Chat anlegen", "In WhatsApp/E-Mail-Thread: Gast als Kontakt speichern"],
          ["Nachricht senden", "Im Kontakt-Drawer: neuen Chat starten"],
          ["Reservierung anlegen", "Im Kontakt-Drawer: direkt Reservierung für diesen Gast"],
        ],
      },
    },
    {
      heading: "Kontakt-Drawer — Felder",
      table: {
        headers: ["Bereich", "Inhalt"],
        rows: [
          ["Stammdaten", "Name, Firma, Anrede"],
          ["Adresse", "Straße, PLZ, Ort, Land"],
          ["E-Mails / Telefon", "Mehrere Kanäle pro Kontakt"],
          ["Lexware", "Verknüpfung mit Lexware-Kontakt (wenn verbunden)"],
          ["Tags", "Freie Labels zur Gruppierung"],
          ["Notizen", "Interne Notizen (nicht für Gäste sichtbar)"],
          ["Timeline", "Reservierungen, Nachrichten, Notizen chronologisch"],
        ],
      },
    },
    {
      heading: "Timeline-Filter",
      body: "Im Kontakt-Drawer kannst du die Timeline filtern: Aktivitätstypen (Reservierungen, Nachrichten, Notizen) und Nachrichten-Kanäle einzeln ein- oder ausblenden.",
    },
    {
      heading: "Nachricht beantworten",
      steps: [
        "Nachrichten → Tab Nachrichten.",
        "Plattform-Chip und ggf. Ungelesen wählen.",
        "Konversation öffnen — Chat-Verlauf erscheint.",
        "Antwort tippen und senden — Gelesen-Status synchronisiert sich.",
      ],
    },
  ],
  tips: [
    "Chats ohne Gwada-Kontakt können nachträglich verknüpft werden — nutze „Kontakt aus Chat anlegen“.",
    "Unter Einstellungen steuerst du, ob Reservierungen und Bewertungen automatisch Kontakte anlegen.",
    "WhatsApp und E-Mail müssen unter Integrationen verbunden sein, sonst bleiben die Chips leer.",
  ],
  related: [
    { label: "Integrationen", href: "/docs/handbuch/integrationen" },
    { label: "Reservierungen", href: "/docs/handbuch/reservierungen" },
  ],
};

export const eventsGuide: UserGuidePage = {
  slug: "events",
  title: "Events",
  description:
    "Öffentliche Termine ankündigen und private Veranstaltungen als Vorgang führen.",
  intro: [
    "Events hat zwei Welten: Öffentliche Termine (Konzerte, Brunch, Specials) erscheinen auf dem Profil, im öffentlichen Embed und optional auf Facebook oder Google. Private Veranstaltungen (Firmenfeier, Hochzeit, geschlossene Gesellschaft) sind ein Vorgang — Anfrage, Angebot, Bestätigung, Rechnung, Team — und landen nie im öffentlichen Feed.",
  ],
  sections: [
    {
      heading: "Öffentlich vs. privat",
      table: {
        headers: ["Art", "Wo sichtbar", "Typischer Ablauf"],
        rows: [
          [
            "Öffentliches Event",
            "Profil, Events-Feed-Embed, optional Social",
            "Anlegen → Veröffentlichen → optional Ankündigen",
          ],
          [
            "Private Veranstaltung",
            "Events-Modul, Reservierungs-Tagesliste und Kalender",
            "Anfrage oder manuell → Angebot/Rechnung → Team",
          ],
        ],
      },
    },
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Öffentliche Events und private Vorgänge, Filter-Chips"],
          ["Statistiken", "Aufrufe und Reichweite öffentlicher Termine"],
          ["Einbinden", "Öffentlicher Feed und Veranstaltungs-Anfrage"],
          ["Einstellungen", "Menüvorschläge, Anfrage-Pakete, Embed-Optionen und Plattform-Hinweise"],
        ],
      },
    },
    {
      heading: "Filter",
      body: "Chips in der Übersicht: Alle (inkl. privat), Privat, Gwada, Facebook, Google. Instagram und WhatsApp dienen vor allem als Ankündigungs-Kanäle — der native Event-Sync läuft über Gwada, Facebook und Google. Der öffentliche Website-Feed zeigt nur veröffentlichte Gwada-Termine, nie private Vorgänge.",
    },
    {
      heading: "Neue private Veranstaltung",
      steps: [
        "Events → Übersicht → Neue Veranstaltung.",
        "Ansprechpartner, Firma, Datum, Personen und Notizen ausfüllen.",
        "Optional Mitarbeiter zuweisen.",
        "Wenn Gäste Menü oder Pakete gewählt haben, liegt schon ein Gwada-Angebot am Vorgang — sonst Angebot selbst anlegen.",
        "Rechnung über die Buchführung erstellen und am Vorgang verknüpfen.",
      ],
    },
    {
      heading: "Menüvorschläge",
      steps: [
        "Events → Einstellungen → Menüvorschläge.",
        "Menü anlegen: Name, Preis pro Person, optional Kinderpreis, min./max. Personen.",
        "Gänge pflegen (Vorspeise, Hauptgang, Dessert). Pro Gang: inklusive für alle — oder Gäste verteilen die Personen auf Gerichte (z. B. 30× Fleisch, 10× vegetarisch).",
        "Gerichte kennzeichnen (vegetarisch, vegan, glutenfrei, Kinder) und optional Aufpreis setzen.",
        "Optionen wie Weinbegleitung (pro Person, ohne Kinder) oder Pauschalen ergänzen.",
        "Im Anfrageformular wählen Gäste ein Menü, tragen Wünsche als Personenzahl ein und klicken die Gerichte zusammen — daraus entsteht das Gwada-Angebot.",
      ],
    },
    {
      heading: "Anfrage-Pakete",
      steps: [
        "Events → Einstellungen → Anfrage-Pakete.",
        "Buffet, Getränke oder Extras anlegen — Name, Kurztext, Preis pro Person, MwSt.",
        "Aktive Pakete erscheinen im Anfrageformular (Website-Embed und Profil-Tab „Anfrage“).",
        "Gäste wählen optional — daraus entsteht ein Gwada-Angebot (ohne Lexoffice) am privaten Vorgang.",
      ],
    },
    {
      heading: "Neues öffentliches Event — Felder",
      table: {
        headers: ["Feld", "Bedeutung"],
        rows: [
          ["Titel", "Name der Veranstaltung"],
          ["Beschreibung", "Details für Gäste"],
          ["Start / Ende", "Datum und Uhrzeit — Ende optional"],
          ["Ort", "Veranstaltungsort"],
          ["Ticketlink", "Externer Link zum Ticketkauf"],
          ["Titelbild", "Cover für Profil, Embed und Social-Ankündigungen"],
          ["Plattform-Chips", "Wo der Termin sichtbar / angekündigt werden soll"],
          ["Ankündigungen", "Optional: Beitrag auf Facebook, Google, Instagram, WhatsApp Kanal"],
        ],
      },
    },
    {
      heading: "Öffentliches Event anlegen",
      steps: [
        "Events → Übersicht → Öffentliches Event.",
        "Titel, Startzeit und Beschreibung ausfüllen — optional Ende, Ort, Ticketlink.",
        "Titelbild hinzufügen, wenn du auf Instagram oder WhatsApp ankündigen willst.",
        "Plattformen und Ankündigungs-Schalter setzen.",
        "Veröffentlichen — Event erscheint auf Profil, Embed und gewählten Kanälen.",
      ],
    },
    {
      heading: "Detail und Sync",
      items: [
        "Gwada-Events lassen sich nachträglich bearbeiten, anpinnen oder löschen",
        "Jetzt synchronisieren — Feed mit verbundenen Plattformen abgleichen",
        "WhatsApp-Kanal wird unter News → Einstellungen konfiguriert (Events verweist dorthin)",
        "Private Vorgänge erscheinen in der Reservierungs-Tagesliste — Klick öffnet das Bearbeiten-Sheet, mit Link nach Events",
      ],
    },
    {
      heading: "Einbinden",
      body: "Unter Einbinden gibt es zwei Snippets. Öffentliche Events: Feed unter /embed/events/[slug] — nur veröffentlichte Termine. Veranstaltungs-Anfrage: Formular unter /embed/veranstaltung/[slug] — Name, Firma, Wunschdatum, Personen, Anlass, optional Menü (Gerichte nach Personen), Buffet/Getränke, Nachricht. Auf dem öffentlichen Profil steckt dasselbe Formular im Events-Sheet unter dem Tab „Anfrage“. Anfragen erscheinen als unbestätigte private Veranstaltung in Events, nicht unter Reservierungen → Unbestätigt.",
    },
  ],
  tips: [
    "Instagram-Ankündigungen brauchen ein Cover-Bild.",
    "Für reine Gwada-Sichtbarkeit reichen Titel, Zeit und Veröffentlichen — Social-Chips sind optional.",
    "Private Veranstaltungen sind ein Zeitslot, kein geschlossener Tag — andere Reservierungen am selben Tag bleiben möglich.",
    "Ohne aktive Menüs oder Pakete bleibt das Anfrageformular frei — der Kalkulator erscheint nur, wenn Preise gepflegt sind.",
  ],
  related: [
    { label: "Events API", href: "/docs/api/events" },
    { label: "Reservierungen", href: "/docs/handbuch/reservierungen" },
    { label: "News (WhatsApp-Kanal)", href: "/docs/handbuch/news" },
    { label: "Öffentliches Profil", href: "/docs/handbuch/oeffentliches-profil" },
  ],
};

export const newsGuide: UserGuidePage = {
  slug: "news",
  title: "News",
  description:
    "Beiträge und Stories erstellen, planen, synchronisieren und per Autopilot vorschlagen lassen.",
  intro: [
    "News ist dein Feed für Ankündigungen — neue Gerichte, Öffnungsänderungen, Aktionen, Team-News. Beiträge erscheinen auf dem öffentlichen Profil, lassen sich einbinden und auf verbundene Plattformen ausspielen.",
    "Stories sind kurze, medienlastige Beiträge (Facebook/Instagram). Autopilot schlägt Beiträge vor, die du freigeben, planen oder überspringen kannst.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Beiträge erstellen, suchen, filtern, pinnen"],
          ["Autopilot", "Vorschläge freigeben, planen oder überspringen"],
          ["Statistiken", "Reichweite der Beiträge"],
          ["Einbinden", "News-Feed als Widget"],
          ["Einstellungen", "Plattformen, WhatsApp-Kanal, Embed-Optionen"],
        ],
      },
    },
    {
      heading: "Filter und Ansicht",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Plattform-Chips", "Alle / Gwada / Facebook / Instagram / Google / WhatsApp Kanal"],
          ["Suche", "News-Texte durchsuchen"],
          ["Raster / Liste", "Ansicht umschalten (URL speichert die Wahl)"],
          ["Jetzt synchronisieren", "Feed mit verbundenen Kanälen abgleichen"],
        ],
      },
    },
    {
      heading: "Neue News — Felder",
      table: {
        headers: ["Feld", "Bedeutung"],
        rows: [
          ["Titel", "Optional — Überschrift des Beitrags"],
          ["Text", "Hauptinhalt / Caption"],
          ["Bild / Video", "Medienanhang — für Instagram Pflicht"],
          ["Planen", "Veröffentlichungszeitpunkt (datetime)"],
          ["Plattform-Chips", "Zielkanäle für den Beitrag"],
          ["Story-Chips", "Als Story auf Facebook/Instagram — nur mit Medien, nicht mit Planung"],
        ],
      },
    },
    {
      heading: "Beitrag veröffentlichen oder planen",
      steps: [
        "News → Übersicht → Neue News.",
        "Text und optional Titel sowie Medien setzen.",
        "Zielplattformen wählen — Instagram nur mit Bild oder Video.",
        "Sofort Veröffentlichen — oder Zeitpunkt setzen und Planen.",
        "Für Stories: Story-Chips aktivieren (ohne Planung).",
      ],
    },
    {
      heading: "Autopilot",
      body: "Unter Autopilot erzeugt gwada Vorschläge. Pro Vorschlag kannst du Titel und Text anpassen, das Bild wechseln und dann freigeben:",
      items: [
        "Freigeben & posten — sofort veröffentlichen",
        "Freigeben (planen) — für späteren Zeitpunkt",
        "Überspringen — Vorschlag verwerfen",
        "Neu vorschlagen — weitere Ideen erzeugen",
      ],
    },
    {
      heading: "Einstellungen",
      items: [
        "Plattform-Status und verbundene Kanäle prüfen",
        "WhatsApp-Kanal auswählen oder anlegen — gilt auch für Event-Ankündigungen",
        "Embed: sichtbare Plattformen, Chip „Alle“, Ansicht Timeline/Raster, Max. Beiträge",
      ],
    },
  ],
  tips: [
    "Stories lassen sich nicht mit einem geplanten Zeitpunkt kombinieren.",
    "Gwada-Beiträge kannst du später speichern, anpinnen oder archivieren.",
    "Externe Beiträge öffnest du oft „Auf … öffnen“ — Bearbeitung liegt dann bei der Plattform.",
  ],
  related: [
    { label: "Integrationen", href: "/docs/handbuch/integrationen" },
    { label: "Events", href: "/docs/handbuch/events" },
    { label: "News API", href: "/docs/api/news" },
  ],
};
