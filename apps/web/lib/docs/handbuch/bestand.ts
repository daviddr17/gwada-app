import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const bestandGuide: UserGuidePage = {
  slug: "bestand",
  title: "Bestand",
  description:
    "Zutaten, Lagerbestände, Bestelllisten, Stammdaten und Spracheingabe.",
  intro: [
    "Bestand hilft dir, Zutaten und Lieferanten zu verwalten, Mindestmengen zu überwachen und Bestelllisten für den Einkauf zu führen. Jedes Gericht in der Speisekarte kann über Rezepte mit Zutaten verknüpft sein.",
    "Am Display-Terminal kann das Modul „Bestand & Bestellung“ freigeschaltet werden — ideal für Küche oder Lager. Rezepte (Gerichte mit Zutaten) sind dort unter „Rezepte“ sichtbar.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Alle Zutaten mit Lagerbestand, Suche, Filter, Bestellmengen"],
          ["Bestellung", "Offene und vergangene Bestellungen je Lieferant"],
          ["Statistiken", "Verbrauch und Bestandsentwicklung"],
        ],
      },
    },
    {
      heading: "Buttons und Toolbar (Übersicht)",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Neue Zutat", "Zutat mit Name, Einheit, Lieferant, Kategorie anlegen"],
          ["Lieferanten", "Stammdaten: Lieferanten verwalten"],
          ["Kategorien", "Stammdaten: Zutaten-Kategorien"],
          ["Produktionsstellen", "Stammdaten: z. B. Küche, Bar, Lager"],
          ["Marken", "Stammdaten: Produktmarken"],
          ["Einheiten", "Stammdaten: kg, l, Stück, …"],
          ["Filter-Icon", "Bottom Sheet: Lieferant, Kategorie, Produktionsstelle, Marke"],
          ["Suche", "Zutatenname oder Gerichte, die die Zutat im Rezept enthalten"],
          ["Spalte Bestellung", "Menge für offene Bestellung je Lieferant — füllt Bestellliste"],
          ["Vollbild-Toggle", "Tabelle im Vollbild — praktisch am Tablet"],
        ],
      },
    },
    {
      heading: "Filter — Übersicht",
      table: {
        headers: ["Filter", "Bedeutung"],
        rows: [
          ["Lieferant", "Nur Zutaten dieses Lieferanten"],
          ["Kategorie", "Nur Zutaten dieser Kategorie"],
          ["Produktionsstelle", "Nur Zutaten dieser Produktionsstelle"],
          ["Marke", "Nur Zutaten dieser Marke"],
        ],
      },
    },
    {
      heading: "Tab Bestellung",
      body: "Hier siehst du alle Bestellungen — gruppiert nach Lieferant. Bestellungen entstehen automatisch, wenn du in der Übersicht Bestellmengen einträgst.",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Zeitraum: Aktive Bestellungen", "Nur offene Bestellungen"],
          ["Zeitraum: Vergangene Bestellungen", "Abgeschlossene Bestellungen"],
          ["Lieferant / Produktionsstelle", "Filter auf Bestellliste"],
          ["Protokoll", "Wer hat wann welche Menge geändert"],
          ["Schließen", "Bestellung abschließen (Einkauf erledigt)"],
          ["Wieder öffnen", "Abgeschlossene Bestellung reaktivieren"],
        ],
      },
    },
    {
      heading: "Spracheingabe (Mikrofon-FAB)",
      body: "Unten rechts erscheint ein Mikrofon-Button — kontextabhängig je Tab:",
      items: [
        "Übersicht: „Bestand per Sprache setzen“ — ersetzt den Lagerbestand der genannten Zutat (nicht addieren)",
        "Bestellung: „Bestellung per Sprache hinzufügen“ — setzt die Bestellmenge (nicht addieren)",
      ],
    },
    {
      heading: "Zutat anlegen",
      steps: [
        "Bestand → Übersicht → Neue Zutat.",
        "Name, Lagereinheit, Lieferant, Kategorie und optional Mindestbestand eintragen.",
        "Aktuellen Bestand setzen oder später per Buchung / Spracheingabe anpassen.",
        "Speichern — die Zutat erscheint in Übersicht, Rezepten und Display (wenn freigeschaltet).",
      ],
    },
  ],
  tips: [
    "Leerer Bestand und offene Bestellungen erscheinen im Dashboard unter Heute → Bestand.",
    "Mindestbestand (Schwellwert) löst Hinweise aus, wenn der Bestand darunter fällt.",
    "Das Bestandsprotokoll pro Zutat zeigt alle Buchungen chronologisch.",
  ],
  related: [
    { label: "Speisekarte (Rezepte)", href: "/docs/handbuch/speisekarte" },
    { label: "Display", href: "/docs/handbuch/display" },
  ],
};
