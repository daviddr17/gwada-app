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
  description: "Veranstaltungen planen, veröffentlichen und einbinden.",
  intro: [
    "Mit Events veröffentlichst du Konzerte, Specials, Brunch-Termine, Weinabende und andere Veranstaltungen. Gäste sehen sie auf deinem Profil, im Embed-Widget oder über die API.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Events anlegen, bearbeiten, chronologisch sortiert"],
          ["Statistiken", "Aufrufe und Reichweite"],
          ["Einbinden", "Widget für externe Websites"],
          ["Einstellungen", "Darstellung und Optionen"],
        ],
      },
    },
    {
      heading: "Buttons und Formular",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Neues Event", "Event anlegen (volle Breite)"],
          ["Titel", "Name der Veranstaltung"],
          ["Datum / Uhrzeit", "Start und optional Ende"],
          ["Beschreibung", "Details für Gäste"],
          ["Bild", "Titelbild auf Profil und Embed"],
          ["Ticket-Link", "Optional: externer Link zum Ticketkauf"],
          ["Veröffentlicht", "Nur veröffentlichte Events sind öffentlich sichtbar"],
        ],
      },
    },
    {
      heading: "Event anlegen",
      steps: [
        "Events → Übersicht → Neues Event.",
        "Titel, Datum, Uhrzeit und Beschreibung eingeben.",
        "Optional Bild und Ticket-Link hinzufügen.",
        "Veröffentlichen — sichtbar auf Profil, Embed und API.",
      ],
    },
  ],
  related: [{ label: "Events API", href: "/docs/api/events" }],
};

export const newsGuide: UserGuidePage = {
  slug: "news",
  title: "News",
  description: "Beiträge, Stories, Facebook-Sync und Feed-Einbindung.",
  intro: [
    "News ist dein Feed für Ankündigungen — neue Gerichte, Öffnungsänderungen, Aktionen, Team-News. Beiträge erscheinen auf dem öffentlichen Profil, lassen sich einbinden und können mit Facebook synchronisiert werden.",
    "Stories sind kurze, bildlastige Beiträge im Vollbild-Stil — ähnlich wie bei Social Media. Gäste sehen sie prominent auf deinem Profil.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Beiträge erstellen, bearbeiten, veröffentlichen"],
          ["Statistiken", "Reichweite der Beiträge"],
          ["Einbinden", "News-Feed als Widget"],
          ["Einstellungen", "Facebook-Sync und Modul-Optionen"],
        ],
      },
    },
    {
      heading: "Buttons und Formular",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Neuer Beitrag", "Text-Beitrag mit optionalen Bildern"],
          ["Story", "Kurzformat mit Vollbild-Darstellung auf dem Profil"],
          ["Text", "Hauptinhalt des Beitrags"],
          ["Bilder", "Mehrere Bilder pro Beitrag möglich"],
          ["Veröffentlicht", "Entwurf vs. live auf Profil"],
        ],
      },
    },
    {
      heading: "Facebook-Sync",
      body: "Wenn Facebook unter Integrationen verbunden ist, können Beiträge automatisch synchronisiert werden. Die genaue Richtung (Gwada → Facebook oder umgekehrt) stellst du unter News → Einstellungen ein.",
    },
  ],
  tips: [
    "Stories eignen sich für Tagesangebote oder kurze Hinweise — Feed-Beiträge für längere Texte.",
    "Der News-Embed auf deiner Website zeigt den gleichen Feed wie das Profil.",
  ],
  related: [
    { label: "Integrationen → Facebook", href: "/docs/handbuch/integrationen" },
    { label: "News API", href: "/docs/api/news" },
  ],
};
