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
          ["Ungelesen", "Nur offene Konversationen — Badge zeigt Anzahl"],
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
    "Veranstaltungen anlegen, auf Plattformen ankündigen und als Widget einbinden.",
  intro: [
    "Mit Events veröffentlichst du Konzerte, Specials, Brunch-Termine, Weinabende und ähnliche Termine. Gwada-Events erscheinen auf dem Profil und im Embed; zusätzlich kannst du Ankündigungen auf Facebook, Google, Instagram oder WhatsApp-Kanal ausspielen.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Events anlegen, bearbeiten, pinnen"],
          ["Statistiken", "Aufrufe und Reichweite"],
          ["Einbinden", "Widget-Snippet und Vorschau"],
          ["Einstellungen", "Embed-Optionen und Plattform-Hinweise"],
        ],
      },
    },
    {
      heading: "Filter",
      body: "Plattform-Chips in der Übersicht: Alle, Gwada, Facebook, Google, Instagram, WhatsApp Kanal. Instagram und WhatsApp dienen vor allem als Ankündigungs-Kanäle — der native Event-Sync läuft über Gwada, Facebook und Google.",
    },
    {
      heading: "Neues Event — Felder",
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
      heading: "Event anlegen",
      steps: [
        "Events → Übersicht → Neues Event.",
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
      ],
    },
    {
      heading: "Einbinden",
      body: "Unter Einbinden kopierst du das Snippet. Einstellungen steuern u. a. Standard-Ansicht (Timeline), maximale Einträge und Chip „Alle“. Öffentliche URL: /embed/events/[slug].",
    },
  ],
  tips: [
    "Instagram-Ankündigungen brauchen ein Cover-Bild.",
    "Für reine Gwada-Sichtbarkeit reichen Titel, Zeit und Veröffentlichen — Social-Chips sind optional.",
  ],
  related: [
    { label: "Events API", href: "/docs/api/events" },
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
