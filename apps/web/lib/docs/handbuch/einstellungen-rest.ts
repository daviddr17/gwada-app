import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const einstellungenGuide: UserGuidePage = {
  slug: "einstellungen",
  title: "Einstellungen",
  description:
    "Restaurant, Team, Integrationen, Displays, API und Dashboard-Konfiguration.",
  intro: [
    "Unter Einstellungen (Sidebar unten) konfigurierst du dein Restaurant — von Adresse und Branding bis zu Teamrechten, externen Diensten und Kiosk-Terminals.",
    "Änderungen werden über eine Sticky-Speichern-Leiste unten bestätigt, sobald du etwas geändert hast.",
  ],
  sections: [
    {
      heading: "Tabs",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Name, Slug, Adresse, Branding, Veröffentlichung"],
          ["Dashboard", "Widgets und Schnellaktionen (FAB)"],
          ["Team", "Rollen (Berechtigungen) und Mitglieder/Einladungen"],
          ["Öffnungszeiten", "Reguläre Zeiten, Feiertage, Sync, Einbinden"],
          ["Integrationen", "WhatsApp, E-Mail, Meta, Google, Lexware, …"],
          ["Displays", "Kiosk-Terminals koppeln und Module freischalten"],
          ["API", "API-Schlüssel für Headless-Einbindung"],
        ],
      },
    },
    {
      heading: "Übersicht — wichtige Bereiche",
      table: {
        headers: ["Bereich", "Bedeutung"],
        rows: [
          ["Profil-Header", "Name, Slug, Avatar, Cover, Visitenkarte"],
          ["Veröffentlichen", "Schalter — ohne Veröffentlichung kein Profil/Embed"],
          ["Adresse & Kontakt", "Standort für Wetter, Karte, Impressum"],
          ["Arbeitgeber (Verträge)", "Daten für Mitarbeiter-Verträge"],
          ["Branding", "Akzentfarbe, Logo — erscheint in App und Profil"],
        ],
      },
    },
    {
      heading: "Dashboard-Tab",
      items: [
        "Widgets — ein/aus und Reihenfolge per Drag & Drop",
        "Schnellaktionen — max. 5 FAB-Shortcuts auswählen",
      ],
    },
    {
      heading: "Team & Rollen",
      body: "Unter Team → Rollen definierst du Berechtigungs-Pakete (z. B. nur Speisekarte, oder alles inkl. Buchführung). Unter Team → Team lädst du Personen per E-Mail ein und weist eine Rolle zu.",
      items: [
        "Rolle = welche Module in der Sidebar sichtbar sind",
        "Einladung — Person erhält E-Mail mit Beitritts-Link",
        "Superadmin ist plattformweit — nicht hier konfiguriert",
      ],
    },
    {
      heading: "Öffnungszeiten",
      items: [
        "Wochenraster — reguläre Öffnungszeiten pro Tag",
        "Feiertage / Ausnahmen — geschlossen oder abweichende Zeiten",
        "Plattform-Sync — an Google/Facebook spiegeln (wenn verbunden)",
        "Sub-Tab Einbinden — Widget nur für Öffnungszeiten",
      ],
    },
    {
      heading: "Displays",
      steps: [
        "Display anlegen — Name und Module wählen.",
        "Kopplcode / QR am Tablet unter /display/pair scannen.",
        "Am Display Module aktivieren (Zeiterfassung, Reservierungen, …).",
        "Optional Sperrbildschirm-Timeout einstellen.",
      ],
    },
    {
      heading: "API",
      items: [
        "Neuer API-Schlüssel — mit Modul-Scopes (nur Speisekarte, oder alles)",
        "Schlüssel geheim halten — nur serverseitig nutzen",
        "Rate Limits — siehe /docs/api/rate-limits",
      ],
    },
  ],
  related: [
    { label: "Integrationen (Detail)", href: "/docs/handbuch/integrationen" },
    { label: "Display", href: "/docs/handbuch/display" },
    { label: "API-Dokumentation", href: "/docs/api" },
  ],
};

export const integrationenGuide: UserGuidePage = {
  slug: "integrationen",
  title: "Integrationen",
  description:
    "WhatsApp, E-Mail, Google, Meta, Lexware, TripAdvisor Schritt für Schritt.",
  intro: [
    "Integrationen verbinden gwada mit externen Diensten. Ohne Verbindung bleiben die jeweiligen Kanäle inaktiv — z. B. kein WhatsApp-Chat in Nachrichten, keine Google-Bewertungen in Insights.",
    "Alle Integrationen konfigurierst du unter Einstellungen → Integrationen. Secrets (API-Keys, Passwörter) werden sicher gespeichert und nie erneut im Klartext angezeigt.",
  ],
  sections: [
    {
      heading: "WhatsApp (WAHA)",
      body: "Ermöglicht WhatsApp-Chats in der Nachrichten-Inbox und WhatsApp-Benachrichtigungen bei Reservierungen.",
      steps: [
        "Einstellungen → Integrationen → WhatsApp.",
        "Session-Name und Zugangsdaten eintragen (vom Administrator).",
        "QR-Code scannen — Verbindung aktiv wenn Status „verbunden“.",
        "Testnachricht senden — erscheint unter Nachrichten → WhatsApp.",
      ],
    },
    {
      heading: "E-Mail (SMTP)",
      body: "Ausgehende E-Mails: Reservierungsbestätigungen, Bewertungseinladungen, Transaktions-Mails.",
      steps: [
        "SMTP-Host, Port, Benutzer, Passwort eintragen.",
        "Absender-Adresse und Name setzen.",
        "Speichern — „… hinterlegt“ zeigt konfigurierten Zustand.",
      ],
    },
    {
      heading: "Google Business Profile",
      body: "Google-Bewertungen in Bewertungen/Insights, Öffnungszeiten-Sync, Standortdaten.",
      steps: [
        "Google verbinden — OAuth-Anmeldung.",
        "Standort auswählen (Restaurant-Filiale).",
        "Bewertungen und Insights → Google-Chip werden aktiv.",
      ],
    },
    {
      heading: "Facebook & Instagram (Meta)",
      body: "Messenger, Instagram Direct, Bewertungen, News-/Galerie-Import, Insights-Reichweite.",
      steps: [
        "Meta verbinden — Facebook-Login.",
        "Seite und ggf. Instagram-Konto auswählen.",
        "Nachrichten-Chips Facebook/Instagram werden aktiv.",
      ],
    },
    {
      heading: "Lexware / Lexoffice",
      body: "Belege und Kontakte mit Buchführung synchronisieren.",
      steps: [
        "Lexware API-Key hinterlegen.",
        "Speichern — Belege unter Buchführung → Quelle „Lexware“.",
      ],
    },
    {
      heading: "TripAdvisor",
      body: "TripAdvisor-Bewertungen und Insights-KPIs.",
      steps: [
        "TripAdvisor-Integration aktivieren und Zugangsdaten hinterlegen.",
        "Insights → TripAdvisor-Chip prüfen.",
      ],
    },
    {
      heading: "Wetter",
      body: "Plattform-Integration (Superadmin) — Dashboard-Widget Wetter am Restaurant-Standort.",
    },
  ],
  tips: [
    "Status-Badges zeigen „Aktiv“ / „Inaktiv“ und „… hinterlegt“ für Secrets.",
    "Nach jeder Integration: passendes Modul testen (Nachricht senden, Bewertung abrufen, …).",
  ],
  related: [
    { label: "Einstellungen", href: "/docs/handbuch/einstellungen" },
    { label: "Nachrichten", href: "/docs/handbuch/nachrichten" },
    { label: "Insights", href: "/docs/handbuch/insights" },
  ],
};

export const displayGuide: UserGuidePage = {
  slug: "display",
  title: "Display (Kiosk)",
  description:
    "Tablet-Terminal koppeln — Zeiterfassung, Reservierungen, Rezepte, Bestand und Checklisten.",
  intro: [
    "Display verwandelt ein Tablet in ein festes Terminal — Stempeluhr, Reservierungsliste, Küchen-Rezepte, Bestand oder HACCP-Checklisten. Ideal für Bereiche ohne Laptop.",
    "Voraussetzung: Feature Displays im Abo und die Berechtigung „Displays verwalten“. Mitarbeiter-PINs legst du unter Profil bzw. Mitarbeiter an — nicht im Display-Panel selbst.",
  ],
  sections: [
    {
      heading: "Display anlegen und koppeln",
      steps: [
        "Einstellungen → Displays → Display anlegen.",
        "Name vergeben, Auto-Lock (15–3600 Sekunden) setzen und Module aktivieren.",
        "Display speichern und öffnen → Koppeln — 8-stelliger Code und QR erscheinen.",
        "Am Tablet /display/pair öffnen — Code eingeben, QR scannen oder Link mit ?code= nutzen.",
        "Nach erfolgreicher Kopplung landet das Gerät auf /display/[slug] mit PIN-Sperre.",
      ],
    },
    {
      heading: "Felder im Display-Editor",
      table: {
        headers: ["Feld", "Bedeutung"],
        rows: [
          ["Name", "Erkennbarer Gerätename (z. B. „Küche“, „Eingang“)"],
          ["Auto-Lock", "Sekunden bis zur Sperre nach Inaktivität"],
          ["Module", "Welche Apps auf dem Terminal erscheinen"],
          ["Display aktiv", "Inaktives Display lässt sich nicht nutzen"],
          ["Koppeln / Neu koppeln", "Neuen Code erzeugen — altes Tablet verliert Zugriff"],
          ["Entkoppeln", "Verbindung zum aktuellen Gerät trennen"],
        ],
      },
    },
    {
      heading: "Module am Display",
      table: {
        headers: ["Modul", "Zweck"],
        rows: [
          ["Zeiterfassung", "Kommen, Gehen, Pause — Mitarbeiter stempelt per PIN"],
          ["Reservierungen", "Tagesliste, Check-in, Status ändern"],
          ["Rezepte", "Gerichte mit Zutaten für die Küche"],
          ["Bestand & Bestellung", "Lagerbestände und Bestellmengen"],
          ["Checklisten", "HACCP und ToDos am Terminal"],
        ],
      },
    },
    {
      heading: "PIN & Sperrbildschirm",
      items: [
        "Jeder Mitarbeiter setzt seine Display-PIN unter Profil → Display-PIN (oder Admin unter Mitarbeiter).",
        "Nach Auto-Lock sperrt sich der Bildschirm — erneute PIN nötig.",
        "Neu koppeln invalidiert das bisherige Tablet sofort.",
      ],
    },
    {
      heading: "Zeiterfassung im Detail",
      body: "Kommen startet die Schicht, Pause unterbricht die Arbeitszeit, Gehen beendet die Schicht. Live-Status erscheint im Dashboard unter Mitarbeiter und Heute → Aktiv / Abgeschlossen.",
    },
  ],
  tips: [
    "Ein Display pro Standort/Bereich anlegen — so bleiben Module und Auto-Lock getrennt konfigurierbar.",
    "Koppel-Links mit Code eignen sich gut für vorbereitete Tablets vor Schichtbeginn.",
  ],
  related: [
    { label: "Mitarbeiter", href: "/docs/handbuch/mitarbeiter" },
    { label: "Checklisten", href: "/docs/handbuch/checklisten" },
    { label: "Bestand", href: "/docs/handbuch/bestand" },
    { label: "Einstellungen → Displays", href: "/docs/handbuch/einstellungen" },
  ],
};

export const oeffentlichesProfilGuide: UserGuidePage = {
  slug: "oeffentliches-profil",
  title: "Öffentliches Profil & Einbinden",
  description:
    "Gästeseite unter gwada.app/[slug], Profil-Apps und Website-Widgets.",
  intro: [
    "Jedes Restaurant hat eine öffentliche Seite unter gwada.app/[dein-slug]. Gäste öffnen Module als Bottom Sheets — News, Events, Galerie, Speisekarte, Reservieren, Bewertungen und Info.",
    "Voraussetzung ist die Veröffentlichung unter Einstellungen → Übersicht sowie aktivierte Module. Widgets auf deiner eigenen Website holst du über die jeweiligen Einbinden-Tabs.",
  ],
  sections: [
    {
      heading: "Profil-Apps (Dock)",
      body: "Unten auf der Profilseite erscheinen Kacheln — nur für Module, die freigeschaltet und sinnvoll befüllt sind:",
      items: [
        "News — Beiträge und Stories",
        "Events — kommende Veranstaltungen",
        "Galerie — Fotos und Highlights",
        "Speisekarte — digitale Karte",
        "Reservieren — Buchungsformular",
        "Bewertungen — Sterne und Texte",
        "Info — Kontakt, Adresse, Öffnungszeiten, Kontaktformular",
      ],
    },
    {
      heading: "Hero und Info",
      items: [
        "Hero zeigt Branding (Logo/Cover) und einen Öffnungsstatus-Chip",
        "Info-Sheet: Kontakt und Öffnungszeiten",
        "Kontaktformular: Vorname, Nachname, E-Mail, Telefon (E-Mail oder Telefon nötig), Nachricht",
      ],
    },
    {
      heading: "Veröffentlichen",
      steps: [
        "Einstellungen → Übersicht.",
        "Slug prüfen (URL-Teil — SEO-relevant, sorgfältig wählen).",
        "Logo, Cover, Adresse und Branding vollständig pflegen.",
        "Schalter „Veröffentlicht“ aktivieren und speichern.",
        "Profil unter gwada.app/[slug] auf dem Handy und Desktop testen.",
      ],
    },
    {
      heading: "Widgets einbinden",
      body: "Jedes Modul mit Tab „Einbinden“ liefert Snippet und Vorschau. Alternativ: JSON-API mit API-Schlüssel. Loader-Skript: /embed/v1/gwada.js.",
      table: {
        headers: ["Modul", "Embed-URL"],
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
    {
      heading: "Embed-Inhalte steuern",
      body: "Welche Plattformen und wie viele Beiträge im News-/Events-Embed erscheinen, legst du in den jeweiligen Modul-Einstellungen fest (Plattform-Toggles, Max. Beiträge, Chip „Alle“).",
    },
    {
      heading: "PWA / Homescreen",
      body: "Gäste können das Profil als App auf dem Homescreen installieren — Icon und Name folgen deinem Branding.",
    },
  ],
  tips: [
    "Ohne Veröffentlichung bleiben Profil und Embeds für Gäste unsichtbar.",
    "Teste Embeds im Tab Einbinden mit der integrierten Vorschau, bevor du den Code auf die Website setzt.",
  ],
  related: [
    { label: "Einstellungen → Übersicht", href: "/docs/handbuch/einstellungen" },
    { label: "News einbinden", href: "/docs/handbuch/news" },
    { label: "API", href: "/docs/api" },
  ],
};

export const profilGuide: UserGuidePage = {
  slug: "profil",
  title: "Profil & Benachrichtigungen",
  description:
    "Persönliches Konto, Anmeldung, Self-Service für Mitarbeiter und Restaurant-Wechsel.",
  intro: [
    "Über dein Profil (Avatar oben rechts) verwaltest du persönliche Daten, Anmeldung und Benachrichtigungen. Mitarbeiter sehen zusätzliche Tabs — abhängig von Rolle und Restaurant-Einstellungen.",
  ],
  sections: [
    {
      heading: "Tabs (immer)",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Persönliche Daten / Übersicht", "Name, Kontaktdaten, Profilinfos"],
          ["Anmeldung", "Passwort, Google-Verknüpfung, Sitzungen"],
          ["Benachrichtigungen", "Push/E-Mail je Ereignistyp"],
        ],
      },
    },
    {
      heading: "Tabs für Mitarbeiter (optional)",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Meine Arbeitszeiten", "Eigene Stempelzeiten einsehen"],
          ["Dienstplan", "Geplante Schichten"],
          ["Verfügbarkeit", "Wunschzeiten an das Team melden"],
          ["Meine Dokumente", "Personalunterlagen (Gehaltszettel, Verträge)"],
          ["Display-PIN", "PIN für Kiosk-Terminal setzen oder ändern"],
        ],
      },
    },
    {
      heading: "Anmeldung absichern",
      steps: [
        "Profil → Anmeldung öffnen.",
        "Passwort ändern, wenn du unsichere Zugangsdaten vermutest.",
        "Optional Google-Konto verknüpfen für schnellere Anmeldung.",
        "Aktive Sitzungen prüfen und fremde Geräte abmelden.",
      ],
    },
    {
      heading: "Mehrere Restaurants",
      body: "Unter „Meine Restaurants“ im Avatar-Menü wechselst du zwischen Betrieben. Jedes Restaurant hat eigene Daten, Module und Berechtigungen — nach dem Wechsel prüfe die Sidebar.",
    },
    {
      heading: "Benachrichtigungen",
      body: "Steuere pro Ereignis, ob du Push und/oder E-Mail erhältst — z. B. neue Reservierung, ungelesene Nachricht, Schichtplan-Änderung oder Checklisten-Erinnerung. Weniger Lärm = nur die Kanäle aktivieren, die du wirklich brauchst.",
    },
  ],
  tips: [
    "Display-PIN solltest du nicht mit Kollegen teilen — jedes Gerät sperrt nach Auto-Lock erneut.",
    "Fehlt ein Mitarbeiter-Tab, liegt das an Rolle oder Modul-Freischaltung — nicht an einem Fehler.",
  ],
  related: [
    { label: "Erste Schritte", href: "/docs/erste-schritte" },
    { label: "Display", href: "/docs/handbuch/display" },
    { label: "Mitarbeiter", href: "/docs/handbuch/mitarbeiter" },
  ],
};
