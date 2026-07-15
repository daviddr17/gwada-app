import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const reservierungenGuide: UserGuidePage = {
  slug: "reservierungen",
  title: "Reservierungen",
  description:
    "Tischreservierungen, Tischplan, Bestätigung, Kanäle und Spracheingabe.",
  intro: [
    "Reservierungen bündelt deinen Tagesplan: Online-Anfragen, manuelle Einträge, Tischplan und Statistiken an einem Ort. Gäste können über dein Profil, ein Website-Widget oder verbundene Kanäle (z. B. WhatsApp) buchen.",
    "Neue Online-Anfragen landen zunächst als „unbestätigt“. Du bestätigst sie manuell oder per Schnell-Bestätigen-Haken — optional mit automatischer WhatsApp- oder E-Mail-Bestätigung an den Gast.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Tages- und Monatsansicht aller Reservierungen"],
          ["Tischplan", "Visueller Grundriss — Tische zuweisen und Belegung sehen"],
          ["Statistiken", "Auslastung, Gästezahlen, Trends"],
          ["Protokoll", "Änderungshistorie (wer hat wann was geändert)"],
          ["Einstellungen", "Zeitfenster, Kanäle, Bestätigungsregeln, AGB"],
          ["Einbinden", "Buchungs-Widget für deine Website"],
        ],
      },
    },
    {
      heading: "Buttons und Aktionen (Übersicht)",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Neue Reservierung", "Manuelle Reservierung anlegen"],
          ["Schnell bestätigen (grüner Haken)", "Bestätigt unbestätigte Anfrage sofort — nur bei Status „Ausstehend“"],
          ["Filter-Icon", "Bottom Sheet: Status, Unbestätigt-Modus, Tagesfilter"],
          ["Monatsansicht", "Kalender mit Tageszähler — Tipp öffnet Tages-Drawer"],
          ["Gwada-Stern", "Gast hat über Gwada-Bewertungslink Feedback hinterlassen"],
        ],
      },
    },
    {
      heading: "Filter — was bedeutet jede Option?",
      table: {
        headers: ["Filter", "Bedeutung"],
        rows: [
          ["Status", "Alle oder einzelner Status (Ausstehend, Bestätigt, Storniert, …)"],
          ["Alle unbestätigten", "Zeigt offene + „Änderung prüfen“ über alle Monate"],
          ["Tage ohne Reservierungen ausblenden", "Monatskalender nur mit belegten Tagen"],
          ["Vergangene Tage ausblenden", "Nur aktueller Monat ab heute"],
        ],
      },
    },
    {
      heading: "Reservierung bearbeiten — Bereiche im Drawer",
      table: {
        headers: ["Bereich", "Inhalt"],
        rows: [
          ["Termin & Status", "Datum, Uhrzeit, Personen, Status, Quelle"],
          ["Gast", "Name, Telefon, E-Mail — Verknüpfung mit Kontakt"],
          ["Tisch & Verweildauer", "Tischzuweisung (nur bei „Bestätigt“), Dauer"],
          ["Nachrichten", "Chat mit dem Gast (WhatsApp, E-Mail, …)"],
          ["Protokoll", "Alle Änderungen an dieser Reservierung"],
          ["Benachrichtigungen & AGB", "Bestätigungsmail, WhatsApp, Einwilligungen"],
        ],
      },
    },
    {
      heading: "Tischplan",
      body: "Im Tischplan legst du Bereiche (z. B. Innen, Terrasse) und Tische als Grundriss an. Du siehst die Belegung pro Tag und kannst Tische per Drag & Drop zuweisen.",
      items: [
        "Neuer Bereich — Raumzone anlegen",
        "Neuer Tisch — Tisch mit Form, Größe und Kapazität",
        "Zoom — Verkleinern / Vergrößern / Zurücksetzen",
        "Tisch bearbeiten / löschen — Kontextmenü am Tisch",
        "Tages-Drawer — Reservierungen des Tages in Listen-, Raster- oder Tisch-Ansicht",
      ],
    },
    {
      heading: "Spracheingabe (Mikrofon-FAB)",
      body: "„Reservierung per Sprache anlegen“ — du sprichst Datum, Uhrzeit, Personen und Gastname. Ein Bestätigungsdialog zeigt die erkannten Werte vor dem Speichern.",
    },
    {
      heading: "Typischer Tagesablauf",
      steps: [
        "Dashboard → Heute → Offen oder Aufmerk. prüfen.",
        "Unbestätigte per Schnell-Bestätigen oder im Drawer bestätigen.",
        "Tischplan öffnen und Tische zuweisen.",
        "Am Abend: Check-in am Display oder Status in der Übersicht ändern.",
      ],
    },
  ],
  tips: [
    "Tischzuordnung ist nur bei Status „Bestätigt“ sinnvoll — ausstehende Anfragen haben noch keinen festen Tisch.",
    "Der Unbestätigt-Modus im Filter entspricht dem Dashboard-Pill „Offen“.",
    "Kanäle (WhatsApp, Website, Profil) konfigurierst du unter Einstellungen → Integrationen und Reservierungen → Einstellungen.",
  ],
  related: [
    { label: "Nachrichten (Gast-Chat)", href: "/docs/handbuch/nachrichten" },
    { label: "Reservierung API", href: "/docs/api/reservation" },
    { label: "Integrationen", href: "/docs/handbuch/integrationen" },
  ],
};
