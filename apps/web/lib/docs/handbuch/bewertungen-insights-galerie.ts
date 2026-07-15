import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const bewertungenGuide: UserGuidePage = {
  slug: "bewertungen",
  title: "Bewertungen",
  description:
    "Gästebewertungen sammeln, Plattformen verbinden und einbinden.",
  intro: [
    "Bewertungen führt Gwada-, Google- und Facebook-Bewertungen in einer Übersicht zusammen. Du kannst Gäste aktiv um Feedback bitten, Bewertungen auf deiner Website einbinden und Statistiken über alle Plattformen vergleichen.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Alle Bewertungen — filterbar nach Plattform"],
          ["Statistiken", "Durchschnitt, Entwicklung, Plattform-Vergleich"],
          ["Einbinden", "Bewertungs-Widget für die Website"],
          ["Einstellungen", "Einladungslinks, Sichtbarkeit, Plattform-Optionen"],
        ],
      },
    },
    {
      heading: "Plattform-Filter",
      body: "In der Übersicht filterst du über Chips oder das Filter-Sheet nach Quelle:",
      items: [
        "Gwada — Bewertungen über dein Gwada-Bewertungsformular",
        "Google — Google Business Profile (Integration nötig)",
        "Facebook — Facebook-Seitenbewertungen (Integration nötig)",
      ],
    },
    {
      heading: "Buttons und Aktionen",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Bewertungslink erstellen", "Persönlicher Link für Gäste (/bewertung/[link])"],
          ["Einladung senden", "Link per WhatsApp, E-Mail oder QR-Code teilen"],
          ["Antworten", "Öffentliche Antwort auf Google/Facebook (wo unterstützt)"],
          ["Lesen/Gelesen", "Interner Gelesen-Status für Gwada-Bewertungen"],
        ],
      },
    },
    {
      heading: "Bewertungseinladung senden",
      steps: [
        "Bewertungen → Einstellungen → Einladungslink erstellen (oder Dashboard-Schnellaktion).",
        "Link an Gäste senden — z. B. nach dem Besuch per WhatsApp.",
        "Gast öffnet das Formular, vergibt Sterne und optional Text.",
        "Neue Bewertung erscheint in der Übersicht und in Statistiken/Insights.",
      ],
    },
  ],
  tips: [
    "Google- und Facebook-Bewertungen erscheinen erst nach Verbindung unter Integrationen.",
    "Gwada-Bewertungen kannst du auch ohne externe Plattform nutzen.",
    "Im Reservierungsmodul zeigt ein Stern-Symbol, wenn der Gast bereits bewertet hat.",
  ],
  related: [
    { label: "Integrationen", href: "/docs/handbuch/integrationen" },
    { label: "Insights", href: "/docs/handbuch/insights" },
    { label: "Bewertungen API", href: "/docs/api/reviews" },
  ],
};

export const insightsGuide: UserGuidePage = {
  slug: "insights",
  title: "Insights",
  description:
    "KPIs und Auswertungen über Gwada und verbundene Plattformen.",
  intro: [
    "Insights bündelt Kennzahlen aus Gwada und — sofern verbunden — Google, Facebook, Instagram, TripAdvisor und Lexoffice. Du siehst Trends zu Reservierungen, Bewertungen, Nachrichten, Buchhaltung und Reichweite in einem Dashboard.",
    "Die verfügbaren Metriken hängen von deinen Integrationen ab. Nicht verbundene Plattformen zeigen einen Hinweis mit Link zu Einstellungen → Integrationen.",
  ],
  sections: [
    {
      heading: "Plattform-Chips",
      body: "Oben wählst du die Datenquelle — jede Plattform hat eigene KPIs und Zeiträume:",
      table: {
        headers: ["Chip", "Typische Kennzahlen"],
        rows: [
          ["Gwada", "Reservierungen, Gwada-Bewertungen, Nachrichten, News — 3/6/12 Monate"],
          ["Google", "Aufrufe, Suchen, Klicks — 30 Tage bis max. verfügbarer Zeitraum"],
          ["Facebook", "Reichweite, Engagement — 7 Tage bis max. Zeitraum"],
          ["Instagram", "Reichweite, Profil-Aufrufe — 7 Tage bis max. Zeitraum"],
          ["TripAdvisor", "Bewertungen, Ranking — wenn TripAdvisor verbunden"],
          ["Lexoffice", "Rechnungen, Angebote, Belege — 3/6/12 Monate (Sync-Daten)"],
        ],
      },
    },
    {
      heading: "Gwada-KPI-Karten",
      table: {
        headers: ["Karte", "Bedeutung"],
        rows: [
          ["Reservierungen", "Anzahl und Entwicklung über gewählten Zeitraum"],
          ["Gwada-Bewertungen", "Neue Bewertungen und Durchschnitt"],
          ["Gwada-Nachrichten", "Eingehende Nachrichten über Gwada-Kanal"],
          ["Gwada-News", "Beitrags-Reichweite im Feed"],
        ],
      },
    },
    {
      heading: "Diagramme",
      body: "Je nach Plattform siehst du z. B. Reservierungen pro Monat, Reservierungen nach Wochentag, Reichweiten-Verläufe oder Bewertungstrends. Zeitraum-Chips schränken den Betrachtungszeitraum ein.",
    },
    {
      heading: "Voraussetzungen",
      items: [
        "Gwada-Daten sind immer verfügbar (Reservierungen, Bewertungen, …).",
        "Google erfordert Google Business Profile unter Integrationen.",
        "Facebook/Instagram erfordern Meta-Verbindung.",
        "TripAdvisor erfordert TripAdvisor-Integration.",
        "Lexoffice erfordert Lexoffice-Integration und Sync der Buchhaltungsdaten.",
      ],
    },
  ],
  tips: [
    "Standard-Ansicht ist Gwada — nicht „Alle Plattformen“ in einer Mischung.",
    "Externe Plattformen haben kürzere max. Zeiträume (API-Limits der Anbieter).",
  ],
  related: [
    { label: "Integrationen", href: "/docs/handbuch/integrationen" },
    { label: "Bewertungen", href: "/docs/handbuch/bewertungen" },
    { label: "Reservierungen", href: "/docs/handbuch/reservierungen" },
  ],
};

export const galerieGuide: UserGuidePage = {
  slug: "galerie",
  title: "Galerie",
  description: "Fotos verwalten, sortieren, importieren und einbinden.",
  intro: [
    "In der Galerie lädst du Bilder hoch — Ambiente, Gerichte, Events, Team. Sie erscheinen auf dem öffentlichen Profil und in Galerie-Widgets auf deiner Website.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Bilder hochladen, sortieren, löschen"],
          ["Statistiken", "Aufrufe und Nutzung"],
          ["Einbinden", "Galerie-Widget (iframe)"],
          ["Einstellungen", "Facebook-Import und Optionen"],
        ],
      },
    },
    {
      heading: "Buttons und Aktionen",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Bild hinzufügen", "Datei wählen oder per Drag & Drop hochladen"],
          ["Sortieren", "Reihenfolge per Drag & Drop — so erscheinen Bilder auf dem Profil"],
          ["Titel", "Optionaler Bildtitel für Barrierefreiheit und SEO"],
          ["Löschen", "Bild dauerhaft entfernen"],
          ["Facebook-Import", "Bilder von verbundener Facebook-Seite importieren (Einstellungen)"],
        ],
      },
    },
  ],
  related: [
    { label: "Galerie API", href: "/docs/api/gallery" },
    { label: "Integrationen → Facebook", href: "/docs/handbuch/integrationen" },
  ],
};
