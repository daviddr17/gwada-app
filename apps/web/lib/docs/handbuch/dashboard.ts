import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const dashboardGuide: UserGuidePage = {
  slug: "dashboard",
  title: "Dashboard",
  description:
    "Startseite mit Widgets, Heute-Briefing, Schnellaktionen und Tagesüberblick.",
  intro: [
    "Das Dashboard ist dein Kommandozentrum nach dem Login. Hier siehst du auf einen Blick, was heute wichtig ist — Reservierungen, Team, Nachrichten, Bestand — ohne jedes Modul einzeln öffnen zu müssen.",
    "Alles auf dem Dashboard ist tippbar: Widgets führen zu Bottom Sheets mit Details, der Plus-Button legt neue Einträge an. Welche Widgets und Schnellaktionen du siehst, stellst du unter Einstellungen → Dashboard ein.",
  ],
  sections: [
    {
      heading: "Widgets — was zeigt welches Widget?",
      table: {
        headers: ["Widget", "Inhalt", "Tippen öffnet"],
        rows: [
          [
            "Heute",
            "Briefing: „Jetzt handeln“ (Klartext-Aktionen) + „Heute läuft“ (Reservierungen, Team, Stunden) — responsive",
            "Bottom Sheet mit Detail-Liste je Eintrag",
          ],
          [
            "Speisekarte",
            "Anzahl Gerichte, Kategorien, Preisspanne",
            "Modul Speisekarte",
          ],
          [
            "Reservierungen",
            "Unbestätigte Anfragen, heutige Reservierungen, Ø Personen (KW)",
            "Bottom Sheets (heute / unbestätigt)",
          ],
          [
            "Bewertungen",
            "Neueste Bewertungen und Plattform-Vergleich",
            "Modul Bewertungen",
          ],
          [
            "Mitarbeiter",
            "Live aktiv, in Pause, abgeschlossen, Arbeitsstunden — plus Namen-Chips der Eingestempelten",
            "Bottom Sheets (Anwesenheit / abgeschlossene Schichten)",
          ],
          [
            "Wetter",
            "Aktuelles Wetter am Standort deines Restaurants",
            "—",
          ],
          [
            "Kontakte",
            "Anzahl Kontakte in der Adressliste",
            "Modul Kontakte",
          ],
          [
            "Nachrichten",
            "Ungelesene Chats über alle Kanäle",
            "Modul Nachrichten",
          ],
          [
            "Integrationen",
            "Status verbundener Dienste (WhatsApp, E-Mail, Google, …)",
            "Einstellungen → Integrationen",
          ],
          [
            "Bestand & Bestellung",
            "Leere Bestände und offene Bestellungen",
            "Modul Bestand",
          ],
        ],
      },
    },
    {
      heading: "Heute-Widget — Briefing",
      body: "Das Heute-Widget ist dein Tagesbriefing in zwei Zonen. Oben „Jetzt handeln“ nur bei Handlungsbedarf (Klartext-Zeilen). Darunter „Heute läuft“ mit ruhigen Kacheln zur Tageslage. Alles ist antippbar und öffnet ein Bottom Sheet — ohne ins Modul zu wechseln. Auf dem Handy untereinander, ab Tablet die Lage in Spalten, auf großen Screens Aktion und Lage nebeneinander.",
      table: {
        headers: ["Bereich", "Bedeutung", "Bottom Sheet"],
        rows: [
          [
            "Jetzt handeln · Reservierungen",
            "Unbestätigte Anfragen (nur wenn > 0)",
            "Liste inkl. Schnell-Bestätigen",
          ],
          [
            "Jetzt handeln · Nachrichten",
            "Ungelesene Konversationen (nur wenn > 0)",
            "Ungelesene Chats",
          ],
          [
            "Jetzt handeln · Bestand",
            "Fällige Lieferungen oder auffälliger Bestand",
            "Zutaten / Bestellungen",
          ],
          [
            "Jetzt handeln · Geburtstage",
            "Team-Geburtstage heute",
            "Namen und Alter",
          ],
          [
            "Heute läuft · Reservierungen",
            "Anzahl heutiger Reservierungen und Personen",
            "Heutige Reservierungsliste",
          ],
          [
            "Heute läuft · Team",
            "Wer gerade eingeloggt ist (fertig in der Meta-Zeile)",
            "Präsenz-Übersicht",
          ],
          [
            "Heute läuft · Arbeitszeit",
            "Erfasste Stunden heute",
            "Stunden-Detail",
          ],
        ],
      },
    },
    {
      heading: "Widgets anpassen",
      steps: [
        "Gehe zu Einstellungen → Dashboard.",
        "Schalte jedes Widget ein oder aus (Schalter).",
        "Ziehe die Reihenfolge per Drag & Drop — oben = weiter oben auf dem Dashboard.",
        "Speichern — das Dashboard aktualisiert sich sofort.",
      ],
    },
    {
      heading: "Schnellaktionen (Plus-Button / FAB)",
      body: "Unten rechts findest du den runden Plus-Button. Ein Tipp öffnet ein Menü mit deinen Schnellaktionen — maximal fünf gleichzeitig aktiv. Welche Aktionen erscheinen, wählst du unter Einstellungen → Dashboard → Schnellaktionen.",
      table: {
        headers: ["Aktion", "Was passiert"],
        rows: [
          ["Neue Reservierung", "Bottom Sheet: Reservierung anlegen"],
          ["Neues Gericht", "Bottom Sheet: Gericht zur Speisekarte hinzufügen"],
          ["Neue Zutat", "Bottom Sheet: Zutat im Bestand anlegen"],
          ["Neuer Kontakt", "Bottom Sheet: Kontakt in der Adressliste anlegen"],
          ["Neues Dokument", "Bottom Sheet: Datei hochladen"],
          ["Neuer Mitarbeiter", "Bottom Sheet: Mitarbeiter-Stammdaten"],
          ["Neue Schicht", "Bottom Sheet: Schicht im Schichtplan"],
          ["Neue Arbeitszeit", "Bottom Sheet: Manuelle Zeiterfassung"],
          ["Schichtvorlage", "Bottom Sheet: Wiederkehrendes Schichtmuster"],
          ["Bewertungslink", "Bottom Sheet: Einladungslink für Gästebewertung"],
        ],
      },
    },
    {
      heading: "Globale Suche und Benachrichtigungen",
      body: "Oben in der Kopfleiste (Desktop) findest du zusätzlich:",
      items: [
        "Suche — durchsucht Gerichte, Kontakte, Reservierungen, Zutaten und mehr plattformweit",
        "Glocke — Benachrichtigungen (neue Reservierungen, Nachrichten, Systemhinweise)",
        "Restaurant-Profil-Link — Vorschau deines öffentlichen Profils",
        "Profil-Avatar — persönliche Einstellungen und Restaurant-Wechsel",
      ],
    },
  ],
  tips: [
    "Das Heute-Widget trennt Handlung und Tageslage — Nuller-Aktionen werden ausgeblendet, damit der Überblick ruhig bleibt.",
    "Nicht jedes Widget muss aktiv sein — blende selten genutzte Module aus, um das Dashboard übersichtlich zu halten.",
    "Reservierungen im Heute-Widget lassen sich direkt per Schnell-Bestätigen-Haken bestätigen, ohne ins Modul zu wechseln.",
  ],
  related: [
    { label: "Navigation in der App", href: "/docs/navigation" },
    { label: "Einstellungen → Dashboard", href: "/docs/handbuch/einstellungen" },
  ],
};
