import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const checklistenGuide: UserGuidePage = {
  slug: "checklisten",
  title: "Aufgaben",
  description:
    "Persönliche Notizen, Team-ToDos, Team-Chat, HACCP und Protokoll.",
  intro: [
    "Aufgaben vereint persönliche Erinnerungen, Team-ToDos (Opening, Closing), internen Team-Chat und HACCP-Erfassungen. Was du siehst, hängt von deinen Berechtigungen ab.",
    "Erfassungen können am Display-Terminal in der Küche erfolgen — das Dashboard dient der Übersicht, dem Chat und dem Abhaken durch Teamleiter.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Meine", "Private Notizen und Erinnerungen (nur du)"],
          ["Team", "Offene Team-ToDos, KPI-Übersicht und operative Aufgaben"],
          ["Nachrichten", "1:1-Chat unter Kollegen"],
          ["Protokoll", "Abgeschlossene Einträge und Änderungshistorie"],
          ["Einstellungen", "Erinnerungen, Korrekturmaßnahmen, Compliance-Optionen"],
        ],
      },
    },

    {
      heading: "KPI-Pills (Übersicht)",
      table: {
        headers: ["Pill", "Bedeutung"],
        rows: [
          ["Offen", "Noch nicht erledigte Aufgaben"],
          ["Überfällig", "Fälligkeitsdatum überschritten"],
          ["Heute erfasst", "Heute abgeschlossene ToDos + Compliance-Einträge"],
        ],
      },
    },
    {
      heading: "Bereiche und Geräte",
      body: "Compliance-Einträge sind Bereichen (z. B. Küche, Bar) und Geräten (z. B. Kühlschrank 1) zugeordnet:",
      items: [
        "Chips „Alle Bereiche“ / „Alle Geräte“ — Filter auf Übersicht",
        "Bereiche / Geräte verwalten — Stammdaten anlegen (Neuer Bereich, Neues Gerät)",
        "ToDo anlegen — manuelle Aufgabe für das Team",
      ],
    },
    {
      heading: "Filter (Übersicht)",
      table: {
        headers: ["Filter", "Bedeutung"],
        rows: [
          ["Status", "Geplant, Offen, Überfällig, Teilweise, Erledigt"],
          ["Priorität", "Hoch, Mittel, Niedrig"],
          ["Zuordnung", "Welchem Mitarbeiter die Aufgabe gilt"],
          ["Bereich / Gerät", "Compliance-Filter"],
        ],
      },
    },
    {
      heading: "Protokoll-Filter",
      table: {
        headers: ["Filter", "Bedeutung"],
        rows: [
          ["Erfassungen / Änderungen", "Was wurde erfasst vs. nachträglich geändert"],
          ["Zeitraum", "Gesamter Zeitraum, Heute, 7 Tage, 30 Tage"],
          ["Abweichungen", "Alle / Nur Abweichungen / Nur ohne Abweichung"],
          ["Sortierung", "Neueste zuerst, …"],
        ],
      },
    },
    {
      heading: "Einstellungen",
      items: [
        "Verschiebe-Grund vorschlagen — bei Verschieben fälliger Kontrollen",
        "Erinnerung bei offenen Kontrollen — Benachrichtigung ans Team",
        "Korrekturmaßnahme bei Temperatur-ToDos — Pflichtfeld bei Abweichung",
        "Glocke bei erledigt/verschoben — Push an Verantwortliche",
      ],
    },
    {
      heading: "ToDos vs. HACCP-Erfassung",
      table: {
        headers: ["Typ", "Beispiel", "Erfassung"],
        rows: [
          ["ToDo", "„Terrasse reinigen“, „Kasse zählen“", "Dashboard abhaken oder Display"],
          ["Temperatur", "Kühlschrank 1: 4 °C", "Display oder manuell — Abweichung löst ToDo"],
          ["Reinigung", "Protokoll Fläche desinfiziert", "Display mit Zeitstempel"],
        ],
      },
    },

  ],
  tips: [
    "Temperatur-ToDos entstehen automatisch bei Grenzwert-Überschreitung.",
    "Compliance-Erfassungen am Display zählen in „Heute erfasst“.",
  ],
  related: [
    { label: "Display → Checklisten", href: "/docs/handbuch/display" },
    { label: "Mitarbeiter", href: "/docs/handbuch/mitarbeiter" },
  ],
};

export const mitarbeiterGuide: UserGuidePage = {
  slug: "mitarbeiter",
  title: "Mitarbeiter",
  description:
    "Team, Schichtplan, Verträge, Arbeitszeiten, Dokumente und Live-Status.",
  intro: [
    "Mitarbeiter ist dein HR-Bereich: Teamverwaltung, Live-Anwesenheit vom Display, Schichtplanung, Verträge, Arbeitszeiten und Personalunterlagen.",
    "Zeiten stammen vom Display (Stempeluhr), manueller Erfassung oder dem Schichtplan. Pausen werden separat erfasst — Dashboard „Heute“ zählt nur reine Arbeitszeit.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Alle Mitarbeiter, Live-Status, Schnellaktionen"],
          ["Arbeitszeiten", "Erfasste Zeiten pro Person und Tag"],
          ["Schichtplan", "Geplante Schichten — Woche/Monat"],
          ["Verträge", "Arbeitsverträge und Beschäftigungsverhältnisse"],
          ["Dokumente", "Personalunterlagen pro Mitarbeiter"],
          ["Statistiken", "Stunden, Auslastung, Auswertungen"],
          ["Export", "Daten exportieren (CSV o. Ä.)"],
          ["Einstellungen", "Profil-Sichtbarkeit, Display-PIN, Vertragsoptionen"],
        ],
      },
    },
    {
      heading: "Übersicht — Buttons",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Mitarbeiter hinzufügen", "Stammdaten anlegen"],
          ["Positionen", "HR-Tags/Stellenbezeichnungen verwalten"],
          ["Live aktiv / In Pause / Abgeschlossen", "Tippbare KPIs → Bottom Sheet mit Namen"],
          ["Namen-Chips", "Schnellübersicht wer gerade eingestempelt ist"],
        ],
      },
    },
    {
      heading: "Schichtplan",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Schicht", "Neue Schicht in der gewählten Woche anlegen"],
          ["Filter und Sortierung", "Mitarbeiter, Bereich (Position), Sortierung Name/Stunden"],
          ["Schichten kopieren", "Woche auf andere Woche übertragen"],
          ["Schichtvorlage (Neu)", "Wiederkehrendes Muster speichern"],
          ["+ in Planzelle", "Schnell Schicht an diesem Tag anlegen"],
          ["Feiertags-Markierung", "Automatische Hinweise auf Feiertage"],
        ],
      },
    },
    {
      heading: "Verträge",
      body: "Neuer Vertrag öffnet „Neues Beschäftigungsverhältnis“ — Vertragsart, Stunden, Vergütung, Laufzeit. Verknüpft mit Mitarbeiter-Dokumenten für PDF-Verträge.",
    },
    {
      heading: "Arbeitszeiten",
      body: "Liste aller erfassten Segmente (Kommen, Gehen, Pause). Filter nach Mitarbeiter und Zeitraum. Korrekturen sind im Protokoll nachvollziehbar.",
    },
    {
      heading: "Einstellungen",
      items: [
        "Profil-Tabs — welche Self-Service-Bereiche Mitarbeiter im Profil sehen",
        "Vertrags-Dokumente — Vorlagen für Arbeitsverträge",
        "Zweistufige Unterzeichnung — optional für Vertrags-Workflow",
      ],
    },
  ],
  tips: [
    "App-Einladung (Login) aus der Mitarbeiter-Akte — Free: 1, Basic: 3, Pro unbegrenzt. Display-PIN zählt nicht als Login.",
    "Verfügbarkeit (Profil) fließt in Schichtplanung ein.",
    "Display-PIN jeder Person unter Profil → Display-PIN.",
  ],
  related: [
    { label: "Display → Zeiterfassung", href: "/docs/handbuch/display" },
    { label: "Aufgaben", href: "/docs/handbuch/checklisten" },
    { label: "Profil", href: "/docs/handbuch/profil" },
  ],
};
