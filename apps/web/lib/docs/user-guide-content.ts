export type UserGuideSection = {
  heading: string;
  body?: string;
  items?: string[];
  steps?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
};

export type UserGuidePage = {
  slug: string;
  title: string;
  description: string;
  intro: string[];
  sections: UserGuideSection[];
  tips?: string[];
  related?: { label: string; href: string }[];
};

export const USER_GUIDE_PAGES: UserGuidePage[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    description: "Deine Startseite mit Widgets, Tagesüberblick und Schnellaktionen.",
    intro: [
      "Das Dashboard ist der erste Bildschirm nach dem Login. Hier siehst du auf einen Blick, was heute wichtig ist — ohne jedes Modul einzeln öffnen zu müssen.",
    ],
    sections: [
      {
        heading: "Widgets",
        body: "Jedes Widget fasst ein Modul kompakt zusammen. Du kannst festlegen, welche Widgets sichtbar sind und in welcher Reihenfolge sie erscheinen.",
        table: {
          headers: ["Widget", "Inhalt"],
          rows: [
            ["Heute", "Tagesüberblick: Reservierungen, Team (aktiv/abgeschlossen/Arbeitszeit), Nachrichten, Bestand-Hinweise"],
            ["Speisekarte", "Anzahl Gerichte, Kategorien, Preisspanne"],
            ["Reservierungen", "Nächste Termine, unbestätigte Anfragen, Ø Personen"],
            ["Bewertungen", "Neueste Bewertungen und Plattform-Vergleich"],
            ["Mitarbeiter", "Live aktiv, in Pause, abgeschlossene Schichten, Namen-Chips"],
            ["Wetter", "Aktuelles Wetter am Standort deines Restaurants"],
            ["Kontakte", "Anzahl Kontakte in deiner Adressliste"],
            ["Nachrichten", "Ungelesene Chats über alle Kanäle"],
            ["Integrationen", "Status verbundener Dienste (WhatsApp, E-Mail, …)"],
            ["Bestand & Bestellung", "Leere Bestände, offene Bestellungen"],
          ],
        },
      },
      {
        heading: "Widgets anpassen",
        steps: [
          "Gehe zu Einstellungen → Dashboard.",
          "Schalte Widgets ein oder aus.",
          "Ziehe die Reihenfolge per Drag & Drop in die gewünschte Anordnung.",
          "Speichern — das Dashboard aktualisiert sich sofort.",
        ],
      },
      {
        heading: "Schnellaktionen (FAB)",
        body: "Unten rechts findest du den runden Plus-Button. Damit legst du häufige Einträge direkt an — z. B. Reservierung, Gericht, Zutat, Kontakt oder Schicht. Welche Aktionen erscheinen, stellst du ebenfalls unter Einstellungen → Dashboard ein (max. fünf gleichzeitig).",
        items: [
          "Reservierung anlegen",
          "Gericht hinzufügen",
          "Zutat / Bestand",
          "Kontakt anlegen",
          "Dokument hochladen",
          "Mitarbeiter anlegen",
          "Schicht planen",
          "Arbeitszeit erfassen",
          "Schichtvorlage",
          "Bewertungseinladung senden",
        ],
      },
    ],
    tips: [
      "Nicht jedes Widget muss aktiv sein — blende Module aus, die du selten brauchst, um das Dashboard übersichtlich zu halten.",
      "Das Heute-Widget zeigt bei Mitarbeitern nur Zahlen (aktiv, abgeschlossen, Arbeitsstunden). Namen findest du im Mitarbeiter-Widget.",
    ],
    related: [
      { label: "Navigation in der App", href: "/docs/navigation" },
      { label: "Einstellungen", href: "/docs/handbuch/einstellungen" },
    ],
  },
  {
    slug: "speisekarte",
    title: "Speisekarte",
    description: "Gerichte, Kategorien, Preise, Allergene und Tageskarten verwalten.",
    intro: [
      "Im Modul Speisekarte pflegst du deine Karte digital. Gäste sehen sie auf deinem öffentlichen Profil, in eingebetteten Widgets oder über die API.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Kategorien und Gerichte bearbeiten, filtern, suchen"],
            ["Statistiken", "Auswertungen zu Gerichten und Kategorien"],
            ["Export", "Speisekarte als Datei exportieren"],
            ["Einbinden", "iframe-Code für deine Website"],
            ["Einstellungen", "Modul-Optionen und Darstellung"],
          ],
        },
      },
      {
        heading: "Gericht anlegen",
        steps: [
          "Öffne Speisekarte → Übersicht.",
          "Klicke auf „Gericht hinzufügen“.",
          "Wähle Kategorie, Name, Preis und optionale Details (Beschreibung, Allergene, Bild).",
          "Speichern — das Gericht erscheint sofort in der Übersicht und auf allen veröffentlichten Kanälen.",
        ],
      },
      {
        heading: "Tageskarten",
        body: "Für wechselnde Angebote kannst du Tageskarten pro Datum anlegen. So bleibt deine Stammspeisekarte unverändert, während du z. B. Mittagsangebote separat führst.",
      },
      {
        heading: "Veröffentlichen",
        body: "Damit Gäste deine Karte sehen, muss dein Restaurant-Profil veröffentlicht sein. Die Einbindung auf der Website erfolgt über Speisekarte → Einbinden oder über die API unter Einstellungen → API.",
      },
    ],
    related: [
      { label: "Öffentliches Profil", href: "/docs/handbuch/oeffentliches-profil" },
      { label: "Speisekarte API", href: "/docs/api/menu" },
    ],
  },
  {
    slug: "bestand",
    title: "Bestand",
    description: "Zutaten, Lagerbestände und Bestellungen im Blick behalten.",
    intro: [
      "Bestand hilft dir, Zutaten zu verwalten, Mindestmengen zu überwachen und Bestelllisten für Lieferanten zu erstellen.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Alle Zutaten mit aktuellem Bestand, Suche und Filter"],
            ["Bestellung", "Bestellliste für offene oder geplante Einkäufe"],
            ["Statistiken", "Verbrauch und Bestandsentwicklung"],
          ],
        },
      },
      {
        heading: "Zutat anlegen",
        steps: [
          "Bestand → Übersicht → „Neue Zutat“.",
          "Name, Einheit und optional Mindestbestand eintragen.",
          "Bestand manuell setzen oder später per Buchung anpassen.",
        ],
      },
      {
        heading: "Bestellung starten",
        body: "Unter Bestellung siehst du Zutaten, die nachbestellt werden sollten. Du kannst Mengen anpassen und die Liste für den Einkauf nutzen.",
      },
      {
        heading: "Display & Rezepte",
        body: "Am Display-Terminal kann das Modul „Bestand & Bestellung“ freigeschaltet werden — ideal für Küche oder Lager. Rezepte (Gerichte mit Zutaten) sind am Display unter „Rezepte“ verfügbar.",
      },
    ],
    related: [{ label: "Display", href: "/docs/handbuch/display" }],
  },
  {
    slug: "reservierungen",
    title: "Reservierungen",
    description: "Tischreservierungen planen, bestätigen und Gäste verwalten.",
    intro: [
      "Reservierungen bündelt deinen Tagesplan: Anfragen von Gästen, manuelle Einträge, Tischplan und Statistiken an einem Ort.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Tages- und Wochenansicht aller Reservierungen"],
            ["Tischplan", "Visueller Grundriss — Tische zuweisen und Belegung sehen"],
            ["Statistiken", "Auslastung, Gästezahlen, Trends"],
            ["Protokoll", "Änderungshistorie (wer hat wann was geändert)"],
            ["Einstellungen", "Zeitfenster, Kanäle, Bestätigungsregeln"],
            ["Einbinden", "Buchungs-Widget für deine Website"],
          ],
        },
      },
      {
        heading: "Reservierung anlegen",
        steps: [
          "Reservierungen → Übersicht.",
          "Plus-Button oder Schnellaktion vom Dashboard.",
          "Datum, Uhrzeit, Personenzahl und Gastdaten eintragen.",
          "Optional Tisch zuweisen und Status setzen (bestätigt, offen, …).",
        ],
      },
      {
        heading: "Unbestätigte Anfragen",
        body: "Online-Anfragen landen zunächst als „unbestätigt“. Du findest sie im Dashboard unter Heute → Aufmerksamkeit oder direkt in der Übersicht mit entsprechendem Filter.",
      },
      {
        heading: "Kanäle",
        body: "Gäste können über dein öffentliches Profil, ein eingebettetes Widget oder verbundene Kanäle (z. B. WhatsApp) reservieren — je nach Konfiguration unter Einstellungen → Integrationen.",
      },
    ],
    related: [
      { label: "Reservierung API", href: "/docs/api/reservation" },
      { label: "Integrationen", href: "/docs/handbuch/einstellungen" },
    ],
  },
  {
    slug: "events",
    title: "Events",
    description: "Veranstaltungen planen und für Gäste sichtbar machen.",
    intro: [
      "Mit Events veröffentlichst du Konzerte, Specials, Brunch-Termine und andere Veranstaltungen — auf deinem Profil, als Embed oder per API.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Events anlegen, bearbeiten, chronologisch sortiert"],
            ["Statistiken", "Reichweite und Aufrufe"],
            ["Einbinden", "Widget für externe Websites"],
            ["Einstellungen", "Darstellung und Optionen"],
          ],
        },
      },
      {
        heading: "Event anlegen",
        steps: [
          "Events → Übersicht → neues Event.",
          "Titel, Datum, Uhrzeit und Beschreibung eingeben.",
          "Optional Bild und Ticket-Link hinzufügen.",
          "Veröffentlichen — sichtbar auf Profil und Embed.",
        ],
      },
    ],
    related: [{ label: "Events API", href: "/docs/api/events" }],
  },
  {
    slug: "nachrichten",
    title: "Nachrichten & Kontakte",
    description: "Multi-Channel-Inbox und Kontaktverwaltung an einem Ort.",
    intro: [
      "Nachrichten ist dein zentraler Posteingang: Gwada-Chat, WhatsApp, E-Mail und weitere Kanäle — plus eine Kontaktliste für alle Gäste und Anfragen.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Nachrichten", "Inbox mit Plattform-Filtern (WhatsApp, E-Mail, Gwada, …)"],
            ["Kontakte", "Adressbuch — alle Kontakte mit Details"],
            ["Statistiken", "Antwortzeiten, Volumen pro Kanal"],
            ["Export", "Kontakte exportieren"],
            ["Einstellungen", "Kanäle verbinden und konfigurieren"],
          ],
        },
      },
      {
        heading: "Nachricht beantworten",
        steps: [
          "Nachrichten → Tab „Nachrichten“.",
          "Plattform-Chip wählen oder „Alle“.",
          "Konversation öffnen und antworten.",
          "Gelesen/ungelesen wird automatisch synchronisiert.",
        ],
      },
      {
        heading: "Kontakt anlegen",
        body: "Unter Kontakte legst du manuell Einträge an oder findest Kontakte, die durch Reservierungen oder Nachrichten entstanden sind.",
      },
      {
        heading: "Kanäle verbinden",
        body: "WhatsApp, E-Mail SMTP, Facebook und weitere Dienste richtest du unter Einstellungen → Integrationen ein. Ohne Verbindung bleibt der jeweilige Kanal inaktiv.",
      },
    ],
    tips: [
      "Ungelesene Nachrichten erscheinen im Dashboard-Widget und unter Heute → Post.",
    ],
    related: [{ label: "Einstellungen → Integrationen", href: "/docs/handbuch/einstellungen" }],
  },
  {
    slug: "news",
    title: "News",
    description: "Beiträge und Updates für Gäste veröffentlichen.",
    intro: [
      "News ist dein Feed für Ankündigungen — z. B. neue Gerichte, Öffnungsänderungen oder Aktionen. Beiträge erscheinen auf dem öffentlichen Profil und lassen sich einbinden.",
    ],
    sections: [
      {
        heading: "Bereiche",
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
        heading: "Beitrag veröffentlichen",
        steps: [
          "News → Übersicht → „Neuer Beitrag“.",
          "Text und optional Bilder hinzufügen.",
          "Veröffentlichen — erscheint im Feed und auf dem Profil.",
        ],
      },
      {
        heading: "Facebook-Sync",
        body: "Wenn Facebook unter Integrationen verbunden ist, können Beiträge automatisch synchronisiert werden (je nach Einstellung unter News → Einstellungen).",
      },
    ],
    related: [{ label: "News API", href: "/docs/api/news" }],
  },
  {
    slug: "bewertungen",
    title: "Bewertungen",
    description: "Gästebewertungen sammeln, lesen und einbinden.",
    intro: [
      "Bewertungen führt Gwada-, Google- und Facebook-Bewertungen zusammen. Du kannst Gäste aktiv um Feedback bitten und Bewertungen auf deiner Website einbinden.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Alle Bewertungen, filterbar nach Plattform"],
            ["Statistiken", "Durchschnitt, Entwicklung, Plattform-Vergleich"],
            ["Einbinden", "Bewertungs-Widget für die Website"],
            ["Einstellungen", "Einladungslinks, Sichtbarkeit"],
          ],
        },
      },
      {
        heading: "Bewertungseinladung senden",
        steps: [
          "Erstelle einen Einladungslink unter Bewertungen → Einstellungen oder nutze die Dashboard-Schnellaktion.",
          "Sende den Link per WhatsApp, E-Mail oder QR-Code an Gäste.",
          "Gäste füllen das Formular unter /bewertung/[link] aus.",
          "Neue Bewertungen erscheinen in der Übersicht.",
        ],
      },
    ],
    related: [{ label: "Bewertungen API", href: "/docs/api/reviews" }],
  },
  {
    slug: "galerie",
    title: "Galerie",
    description: "Fotos deines Restaurants verwalten und zeigen.",
    intro: [
      "In der Galerie lädst du Bilder hoch — von Ambiente, Gerichten oder Events. Sie erscheinen auf dem öffentlichen Profil und in eingebetteten Galerie-Widgets.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Bilder hochladen, sortieren, löschen"],
            ["Statistiken", "Aufrufe und Nutzung"],
            ["Einbinden", "Galerie-Widget"],
            ["Einstellungen", "Facebook-Import und Optionen"],
          ],
        },
      },
      {
        heading: "Bilder hochladen",
        steps: [
          "Galerie → Übersicht.",
          "„Bild hinzufügen“ — Datei wählen oder per Drag & Drop.",
          "Optional Titel oder Reihenfolge anpassen.",
        ],
      },
    ],
    related: [{ label: "Galerie API", href: "/docs/api/gallery" }],
  },
  {
    slug: "buchfuehrung",
    title: "Buchführung",
    description: "Rechnungen, Angebote, Belege und Kassenbuch.",
    intro: [
      "Buchführung unterstützt dich bei Rechnungsstellung, Angeboten und der Dokumentation von Einnahmen und Ausgaben. Optional lässt sich Lexoffice anbinden.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Rechnungen", "Rechnungen erstellen und verwalten"],
            ["Angebote", "Angebote an Kunden"],
            ["Belege", "Eingangs- und Ausgangsbelege"],
            ["Kasse", "Kassenbuch (Einnahmen/Ausgaben)"],
            ["Statistiken", "Auswertungen"],
            ["Einstellungen", "Steuer, Lexoffice, Nummernkreise"],
          ],
        },
      },
      {
        heading: "Rechnung erstellen",
        steps: [
          "Buchführung → Rechnungen → „Neue Rechnung“.",
          "Kunde, Positionen und Beträge eintragen.",
          "Als Entwurf speichern oder abschließen und versenden.",
        ],
      },
      {
        heading: "Lexoffice",
        body: "Unter Einstellungen → Integrationen (Restaurant) oder Buchführung → Einstellungen kann Lexoffice verbunden werden, um Belege zu synchronisieren.",
      },
      {
        heading: "Fiskaly / Kasse (TSE)",
        body: "Für gesetzeskonforme Kassensysteme gibt es separate Einstellungen unter Einstellungen → Kasse (Fiskaly TSE). Das ist unabhängig vom Kassenbuch-Tab in Buchführung.",
      },
    ],
    related: [{ label: "Einstellungen", href: "/docs/handbuch/einstellungen" }],
  },
  {
    slug: "dokumente",
    title: "Dokumente",
    description: "Dateien zentral ablegen, versionieren und nachverfolgen.",
    intro: [
      "Dokumente ist deine Ablage für Verträge, Zertifikate, Hygieneunterlagen und andere Dateien — mit Versionshistorie und Protokoll.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Alle Dokumente mit Suche, Filter und Pagination"],
            ["Statistiken", "Übersicht über Dokumenttypen"],
            ["Protokoll", "Wer hat wann welches Dokument geändert"],
          ],
        },
      },
      {
        heading: "Dokument hochladen",
        steps: [
          "Dokumente → Übersicht → „Neues Dokument“.",
          "Datei wählen, Titel und optional Kategorie setzen.",
          "Speichern — neue Versionen ersetzen die Datei, alte Versionen bleiben im Protokoll nachvollziehbar.",
        ],
      },
    ],
    related: [{ label: "Mitarbeiter-Dokumente", href: "/docs/handbuch/mitarbeiter" }],
  },
  {
    slug: "checklisten",
    title: "Checklisten",
    description: "Aufgaben für das Team und HACCP-Eigenkontrolle.",
    intro: [
      "Checklisten vereint zwei Bereiche: ToDo-Listen für Mitarbeiter und HACCP/Eigenkontrolle (Temperaturen, Reinigung, Protokolle). Was du siehst, hängt von deinen Berechtigungen ab.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Offene ToDos oder Compliance-Einträge des Tages"],
            ["Protokoll", "Abgeschlossene Einträge und Historie"],
            ["Einstellungen", "Vorlagen, Geräte, Compliance-Bereiche aktivieren"],
          ],
        },
      },
      {
        heading: "ToDos (Mitarbeiter-Aufgaben)",
        body: "Teamleiter legen Aufgaben an, Mitarbeiter haken sie ab. Ideal für Opening/Closing-Listen oder wiederkehrende Aufgaben.",
      },
      {
        heading: "Eigenkontrolle / HACCP",
        body: "Temperaturkontrollen, Reinigungsprotokolle und Geräte-Checks — alles mit Zeitstempel und Nachweis im Protokoll.",
      },
      {
        heading: "Am Display",
        body: "Das Display-Modul „Checklisten“ erlaubt das Ausfüllen direkt am Terminal in der Küche — ohne Laptop.",
      },
    ],
    related: [{ label: "Display", href: "/docs/handbuch/display" }],
  },
  {
    slug: "mitarbeiter",
    title: "Mitarbeiter",
    description: "Team, Schichten, Verträge, Arbeitszeiten und Dokumente.",
    intro: [
      "Mitarbeiter ist dein HR-Bereich: Wer arbeitet bei dir, wann sind Schichten geplant, welche Verträge und Arbeitszeiten liegen vor?",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Alle Mitarbeiter, Live-Status (aktiv/Pause/abgeschlossen)"],
            ["Arbeitszeiten", "Erfasste Zeiten pro Person und Tag"],
            ["Schichtplan", "Geplante Schichten — Woche/Monat"],
            ["Verträge", "Arbeitsverträge verwalten"],
            ["Dokumente", "Personalunterlagen pro Mitarbeiter"],
            ["Statistiken", "Stunden, Auslastung, Auswertungen"],
            ["Export", "Daten exportieren"],
            ["Einstellungen", "Sichtbarkeit im Profil, Display-PIN, Optionen"],
          ],
        },
      },
      {
        heading: "Mitarbeiter anlegen",
        steps: [
          "Mitarbeiter → Übersicht → „Mitarbeiter hinzufügen“.",
          "Stammdaten eintragen und Rolle/Position zuweisen.",
          "Optional Einladung ins Team senden (Einstellungen → Team).",
        ],
      },
      {
        heading: "Arbeitszeiten",
        body: "Zeiten kommen vom Display (Stempeluhr), manueller Erfassung oder dem Schichtplan. Pausen werden separat erfasst — die Dashboard-Zahl „Heute“ zählt nur reine Arbeitszeit ohne Pausen.",
      },
      {
        heading: "Schichtplan",
        body: "Unter Schichtplan planst du wer wann arbeitet. Filter und Vorlagen erleichtern wiederkehrende Muster.",
      },
    ],
    tips: [
      "Im Dashboard-Widget Mitarbeiter siehst du Namen-Chips aller Live-Aktiven und Personen in Pause.",
    ],
    related: [
      { label: "Display Zeiterfassung", href: "/docs/handbuch/display" },
      { label: "Profil (Mitarbeiter-Self-Service)", href: "/docs/handbuch/profil" },
    ],
  },
  {
    slug: "einstellungen",
    title: "Einstellungen",
    description: "Restaurant, Team, Integrationen, Displays und API.",
    intro: [
      "Unter Einstellungen (Sidebar unten) konfigurierst du dein Restaurant — von Adresse und Branding bis zu Teamrechten und externen Diensten.",
    ],
    sections: [
      {
        heading: "Bereiche",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Name, Adresse, Slug, Branding, Veröffentlichung"],
            ["Dashboard", "Widget- und Schnellaktions-Konfiguration"],
            ["Team", "Rollen (Berechtigungen) und Teammitglieder/Einladungen"],
            ["Öffnungszeiten", "Reguläre Zeiten und Ausnahmen (Feiertage)"],
            ["Integrationen", "WhatsApp, E-Mail, Facebook, Google, Lexoffice, …"],
            ["Displays", "Kiosk-Terminals koppeln und Module freischalten"],
            ["API", "API-Schlüssel für Headless-Einbindung"],
          ],
        },
      },
      {
        heading: "Team & Rollen",
        body: "Unter Team → Rollen definierst du, welche Module ein Mitarbeiter sehen darf (z. B. nur Speisekarte, oder alles inkl. Buchführung). Unter Team → Team lädst du Personen per E-Mail ein.",
      },
      {
        heading: "Öffnungszeiten einbinden",
        body: "Unter Öffnungszeiten → Einbinden erhältst du ein Widget, das nur deine Öffnungszeiten auf externen Seiten anzeigt.",
      },
      {
        heading: "Sidebar-Reihenfolge",
        body: "Die Reihenfolge der Module in der Sidebar kann vom Superadmin plattformweit vorgegeben werden. Du siehst nur Module, für die deine Rolle Berechtigungen hat.",
      },
    ],
    related: [
      { label: "API-Dokumentation", href: "/docs/api" },
      { label: "Display", href: "/docs/handbuch/display" },
    ],
  },
  {
    slug: "display",
    title: "Display (Kiosk)",
    description: "Tablet-Terminal für Zeiterfassung, Reservierungen und Küche.",
    intro: [
      "Display verwandelt ein Tablet in ein festes Terminal in deinem Restaurant — für Stempeluhr, Reservierungsliste, Rezepte, Bestand oder Checklisten.",
    ],
    sections: [
      {
        heading: "Einrichtung",
        steps: [
          "Einstellungen → Displays → neues Display anlegen.",
          "Kopplcode notieren.",
          "Am Tablet /display/pair öffnen und Code eingeben.",
          "Am Display die gewünschten Module freischalten.",
        ],
      },
      {
        heading: "Verfügbare Module",
        table: {
          headers: ["Modul", "Zweck"],
          rows: [
            ["Zeiterfassung", "Kommen, Gehen, Pause — Mitarbeiter stempeln per PIN"],
            ["Reservierungen", "Tagesliste, Check-in, Status ändern"],
            ["Rezepte", "Gerichte mit Zutaten für die Küche"],
            ["Bestand & Bestellung", "Lagerbestände und Bestellmengen"],
            ["Checklisten", "HACCP und ToDos am Terminal"],
            ["Bestellungen (KDS)", "Küchen-Display — in Planung"],
          ],
        },
      },
      {
        heading: "PIN & Sperrbildschirm",
        body: "Mitarbeiter melden sich am Display mit ihrer persönlichen PIN an (einstellbar unter Profil → Display-PIN). Nach Inaktivität sperrt sich der Bildschirm automatisch.",
      },
    ],
    related: [
      { label: "Mitarbeiter", href: "/docs/handbuch/mitarbeiter" },
      { label: "Profil → Display-PIN", href: "/docs/handbuch/profil" },
    ],
  },
  {
    slug: "oeffentliches-profil",
    title: "Öffentliches Profil & Einbinden",
    description: "Deine Gästeseite und Widgets für externe Websites.",
    intro: [
      "Jedes Restaurant hat eine öffentliche Seite unter gwada.app/[dein-slug]. Gäste finden dort News, Events, Speisekarte, Reservierung und mehr — je nach aktivierten Modulen.",
    ],
    sections: [
      {
        heading: "Profil-Apps",
        body: "Auf dem Profil erscheinen Kacheln für aktivierte Module:",
        items: [
          "News — aktuelle Beiträge",
          "Events — kommende Veranstaltungen",
          "Galerie — Fotos",
          "Speisekarte — digitale Karte",
          "Reservieren — Buchungsformular",
          "Bewertungen — Gästebewertungen",
          "Info — Kontakt und Öffnungszeiten",
        ],
      },
      {
        heading: "Veröffentlichen",
        steps: [
          "Einstellungen → Übersicht.",
          "Slug und Stammdaten prüfen.",
          "Restaurant veröffentlichen — erst dann sind Profil und Embeds erreichbar.",
        ],
      },
      {
        heading: "Widgets einbinden",
        body: "Jedes Modul mit Tab „Einbinden“ liefert einen iframe-Code für deine Website. Alternativ nutzt du die JSON-API (Einstellungen → API) für eigene Frontends.",
        table: {
          headers: ["Modul", "Embed-Pfad"],
          rows: [
            ["Speisekarte", "/embed/speisekarte/[slug]"],
            ["Reservieren", "/embed/reservieren/[slug]"],
            ["Bewertungen", "/embed/bewertungen/[slug]"],
            ["News", "/embed/news/[slug]"],
            ["Events", "/embed/events/[slug]"],
            ["Galerie", "/embed/gallery/[slug]"],
            ["Öffnungszeiten", "/embed/oeffnungszeiten/[slug]"],
          ],
        },
      },
    ],
    related: [
      { label: "API Einstieg", href: "/docs/api" },
      { label: "Einstellungen", href: "/docs/handbuch/einstellungen" },
    ],
  },
  {
    slug: "profil",
    title: "Profil & Benachrichtigungen",
    description: "Dein persönliches Konto und Mitarbeiter-Self-Service.",
    intro: [
      "Über dein Profil (Avatar oben rechts) verwaltest du persönliche Daten, Anmeldung und Benachrichtigungen. Mitarbeiter sehen zusätzliche Tabs — abhängig von den Einstellungen des Restaurants.",
    ],
    sections: [
      {
        heading: "Immer verfügbar",
        table: {
          headers: ["Tab", "Zweck"],
          rows: [
            ["Übersicht", "Persönliche Daten"],
            ["Anmeldung", "Passwort, Sitzungen"],
            ["Benachrichtigungen", "Push/E-Mail für App-Ereignisse"],
          ],
        },
      },
      {
        heading: "Für Mitarbeiter (optional sichtbar)",
        items: [
          "Meine Arbeitszeiten — eigene Stempelzeiten einsehen",
          "Dienstplan — geplante Schichten",
          "Verfügbarkeit — Wunschzeiten melden",
          "Meine Dokumente — Personalunterlagen",
          "Display-PIN — PIN für das Kiosk-Terminal",
        ],
      },
      {
        heading: "Mehrere Restaurants",
        body: "Unter „Meine Restaurants“ wechselst du zwischen Betrieben, für die du Zugriff hast. Jedes Restaurant hat eigene Daten und Einstellungen.",
      },
    ],
    related: [
      { label: "Erste Schritte", href: "/docs/erste-schritte" },
      { label: "Display", href: "/docs/handbuch/display" },
    ],
  },
];

export const USER_GUIDE_BY_SLUG = new Map(
  USER_GUIDE_PAGES.map((page) => [page.slug, page] as const),
);

export function userGuideSlugs(): string[] {
  return USER_GUIDE_PAGES.map((page) => page.slug);
}

export function userGuideBySlug(slug: string): UserGuidePage | undefined {
  return USER_GUIDE_BY_SLUG.get(slug);
}
