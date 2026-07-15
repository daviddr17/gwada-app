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
    "Tablet-Terminal für Zeiterfassung, Reservierungen, Rezepte und Checklisten.",
  intro: [
    "Display verwandelt ein Tablet in ein festes Terminal — für Stempeluhr, Reservierungsliste, Küchen-Rezepte, Bestand oder HACCP-Checklisten. Ideal für Bereiche ohne Laptop.",
  ],
  sections: [
    {
      heading: "Einrichtung",
      steps: [
        "Einstellungen → Displays → Display anlegen.",
        "Name vergeben und erlaubte Module auswählen.",
        "Am Tablet /display/pair öffnen.",
        "Kopplcode eingeben oder QR scannen.",
        "Display ist verbunden — Module erscheinen auf dem Startbildschirm.",
      ],
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
          ["Bestellungen (KDS)", "Küchen-Display — in Planung"],
        ],
      },
    },
    {
      heading: "PIN & Sperrbildschirm",
      items: [
        "Jeder Mitarbeiter hat eine Display-PIN (Profil → Display-PIN).",
        "Nach Inaktivität sperrt sich der Bildschirm — erneute PIN-Eingabe nötig.",
        "Admin-PIN am Display für Einstellungen (vom Display-Manager).",
      ],
    },
    {
      heading: "Zeiterfassung im Detail",
      body: "Kommen startet Schicht, Pause unterbricht Arbeitszeit, Gehen beendet Schicht. Live-Status erscheint im Dashboard unter Mitarbeiter und Heute → Aktiv.",
    },
  ],
  related: [
    { label: "Mitarbeiter", href: "/docs/handbuch/mitarbeiter" },
    { label: "Checklisten", href: "/docs/handbuch/checklisten" },
    { label: "Bestand", href: "/docs/handbuch/bestand" },
  ],
};

export const oeffentlichesProfilGuide: UserGuidePage = {
  slug: "oeffentliches-profil",
  title: "Öffentliches Profil & Einbinden",
  description: "Gästeseite, Profil-Apps, Veröffentlichung und Website-Widgets.",
  intro: [
    "Jedes Restaurant hat eine öffentliche Seite unter gwada.app/[dein-slug]. Gäste finden dort News, Events, Speisekarte, Reservierung und mehr — je nach aktivierten Modulen und Veröffentlichungsstatus.",
  ],
  sections: [
    {
      heading: "Profil-Apps (Kacheln)",
      items: [
        "News — aktuelle Beiträge und Stories",
        "Events — kommende Veranstaltungen",
        "Galerie — Fotos",
        "Speisekarte — digitale Karte",
        "Reservieren — Buchungsformular",
        "Bewertungen — Gästebewertungen und Durchschnitt",
        "Info — Kontakt, Adresse, Öffnungszeiten",
      ],
    },
    {
      heading: "Veröffentlichen",
      steps: [
        "Einstellungen → Übersicht.",
        "Slug prüfen (URL-Teil — einmalig, SEO-relevant).",
        "Stammdaten, Bilder und Branding vollständig pflegen.",
        "Schalter „Veröffentlicht“ aktivieren.",
        "Profil unter gwada.app/[slug] testen.",
      ],
    },
    {
      heading: "Widgets einbinden (iframe)",
      body: "Jedes Modul mit Tab „Einbinden“ liefert einen iframe-Code. Alternativ: JSON-API für eigene Frontends.",
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
      heading: "PWA / App-Icon",
      body: "Gäste können dein Profil als App auf dem Homescreen installieren — eigenes Icon und Name je nach Branding.",
    },
  ],
  related: [
    { label: "Einstellungen → Übersicht", href: "/docs/handbuch/einstellungen" },
    { label: "API", href: "/docs/api" },
  ],
};

export const profilGuide: UserGuidePage = {
  slug: "profil",
  title: "Profil & Benachrichtigungen",
  description: "Persönliches Konto, Mitarbeiter-Self-Service und Restaurant-Wechsel.",
  intro: [
    "Über dein Profil (Avatar oben rechts) verwaltest du persönliche Daten, Anmeldung und Benachrichtigungen. Mitarbeiter sehen zusätzliche Tabs — abhängig von den Einstellungen des Restaurants.",
  ],
  sections: [
    {
      heading: "Tabs (immer)",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Name, E-Mail, persönliche Daten"],
          ["Anmeldung", "Passwort ändern, aktive Sitzungen"],
          ["Benachrichtigungen", "Push/E-Mail für App-Ereignisse"],
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
          ["Verfügbarkeit", "Wunschzeiten an Team melden"],
          ["Meine Dokumente", "Personalunterlagen (Gehaltszettel, Verträge)"],
          ["Display-PIN", "PIN für Kiosk-Terminal setzen"],
        ],
      },
    },
    {
      heading: "Mehrere Restaurants",
      body: "Unter „Meine Restaurants“ (Avatar-Menü) wechselst du zwischen Betrieben. Jedes Restaurant hat eigene Daten, Module und Berechtigungen.",
    },
    {
      heading: "Benachrichtigungen",
      body: "Steuere, bei welchen Ereignissen du Push oder E-Mail erhältst — z. B. neue Reservierung, ungelesene Nachricht, Checklisten-Erinnerung.",
    },
  ],
  related: [
    { label: "Erste Schritte", href: "/docs/erste-schritte" },
    { label: "Display", href: "/docs/handbuch/display" },
    { label: "Mitarbeiter", href: "/docs/handbuch/mitarbeiter" },
  ],
};
