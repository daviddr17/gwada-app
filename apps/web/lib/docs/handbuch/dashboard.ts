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
            "Tages-Briefing als kompakte Pills: Reservierungen, Offene Anfragen, Aufmerksamkeit, Team, Nachrichten, Bestand",
            "Bottom Sheet mit Detail-Liste je Pill",
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
      heading: "Heute-Widget — jede Pill erklärt",
      body: "Das Heute-Widget ist dein Tagesbriefing. Jede farbige Pill ist antippbar und öffnet ein Bottom Sheet — es navigiert nicht ins Modul, sondern zeigt dir die Liste direkt auf dem Dashboard.",
      table: {
        headers: ["Pill", "Bedeutung", "Bottom Sheet"],
        rows: [
          [
            "Reserv.",
            "Anstehende Reservierungen heute · Personenzahl",
            "Liste aller heutigen Reservierungen mit Uhrzeit",
          ],
          [
            "Offen",
            "Noch unbestätigte Online-Anfragen",
            "Liste unbestätigter Reservierungen inkl. Schnell-Bestätigen",
          ],
          [
            "Aufmerk.",
            "Summe aus unbestätigten Reservierungen + ungelesenen Nachrichten",
            "Kombinierte Aufmerksamkeits-Liste",
          ],
          [
            "Aktiv",
            "Mitarbeiter gerade eingestempelt (Display)",
            "Wer ist in Schicht, seit wann",
          ],
          [
            "Abgeschlossen",
            "Heute abgeschlossene Display-Schichten",
            "Schichten mit Zeiten und Pausen",
          ],
          [
            "Heute",
            "Erfasste Arbeitsstunden heute (ohne Pausen)",
            "Aktive + abgeschlossene Zeiten im Überblick",
          ],
          [
            "Post",
            "Ungelesene Nachrichten (alle Kanäle)",
            "Liste ungelesener Konversationen",
          ],
          [
            "Bestand",
            "Leerer Bestand · offene Bestellungen (nur bei Auffälligkeiten)",
            "Betroffene Zutaten und offene Bestellungen",
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
    "Das Heute-Widget zeigt bei Mitarbeitern nur Zahlen. Namen der Eingestempelten findest du im Mitarbeiter-Widget als Chips.",
    "Nicht jedes Widget muss aktiv sein — blende selten genutzte Module aus, um das Dashboard übersichtlich zu halten.",
    "Reservierungen im Heute-Widget lassen sich direkt per Schnell-Bestätigen-Haken bestätigen, ohne ins Modul zu wechseln.",
  ],
  related: [
    { label: "Navigation in der App", href: "/docs/navigation" },
    { label: "Einstellungen → Dashboard", href: "/docs/handbuch/einstellungen" },
  ],
};
