import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const speisekarteGuide: UserGuidePage = {
  slug: "menu",
  title: "Speisekarte",
  description:
    "Gerichte, Kategorien, Preise, Tags, Zusatzstoffe/Allergene, Tageskarten und Einbindung.",
  intro: [
    "Im Modul Speisekarte pflegst du deine digitale Karte. Gäste sehen sie auf deinem öffentlichen Profil, in eingebetteten Widgets auf deiner Website oder über die JSON-API.",
    "Die Speisekarte ist in Kategorien gegliedert. Jedes Gericht kann Preis, Beschreibung, Bild, Tags, länderpflichtige Kennzeichnungen (Zusatzstoffe & Allergene) und ein Rezept (Zutaten aus dem Bestand) haben. Tageskarten erlauben wechselnde Angebote pro Datum, ohne die Stammspeisekarte zu ändern.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Gerichte und Kategorien bearbeiten, suchen, filtern"],
          ["Statistiken", "Auswertungen zu Gerichten und Kategorien"],
          ["Export", "Speisekarte als Datei exportieren"],
          ["Einbinden", "iframe-Code für deine Website"],
          ["Einstellungen", "Modul-Optionen und Darstellung"],
        ],
      },
    },
    {
      heading: "Buttons und Toolbar (Übersicht)",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Gericht hinzufügen", "Neues Gericht anlegen (volle Breite über der Liste)"],
          ["Tags", "Stammdaten für Diät-/Eigenschafts-Tags verwalten (z. B. Vegan, Scharf)"],
          ["Allergene", "Freiform-Allergen-Chips (Stammdaten) — ergänzend zu den Pflichtkennzeichnungen"],
          ["Kategorien", "Kategorien sortieren, umbenennen, aktivieren/deaktivieren"],
          ["+ (neben Kategorien)", "Neue Kategorie anlegen"],
          ["Hauptkategorien", "Obere Gruppierung (z. B. Speisen / Getränke) verwalten"],
          ["Filter-Icon", "Bottom Sheet: Eigenschaften und Preisspanne"],
          ["Kompakte Tabelle / Karten mit Bild", "Ansichtsmodus umschalten"],
          ["Suche", "Gerichte oder Zutaten im Rezept durchsuchen"],
        ],
      },
    },
    {
      heading: "Filter — was bedeutet jede Option?",
      table: {
        headers: ["Filter", "Bedeutung"],
        rows: [
          ["Eigenschaften", "Zeigt nur Gerichte mit gewähltem Tag (Vegan, Bio, …). Standard: Alle"],
          ["Preisspanne", "Slider von 0 € bis zum teuersten Gericht — schränkt die Liste ein"],
          ["Zurücksetzen", "Setzt alle Filter auf Standard zurück"],
          ["Fertig", "Schließt das Filter-Sheet und wendet die Auswahl an"],
        ],
      },
    },
    {
      heading: "Gericht anlegen oder bearbeiten",
      body: "Ein Tipp auf ein Gericht oder „Gericht hinzufügen“ öffnet ein Bottom Sheet. Wichtige Felder:",
      table: {
        headers: ["Feld", "Bedeutung"],
        rows: [
          ["Name", "Anzeigename auf Profil, Embed und API"],
          ["Kategorie", "Ordnet das Gericht einer Kategorie zu"],
          ["Anzeige-Nummer", "Optionale Nummer auf der Karte (z. B. „12“)"],
          ["Preis (€)", "Verkaufspreis — wird in Statistiken und Export genutzt"],
          ["Beschreibung", "Freitext für Gäste"],
          ["Gericht aktiv", "Aus = Gericht wird nirgends angezeigt"],
          ["Anzeige von / bis", "Zeitlich begrenzte Sichtbarkeit (Saison, Aktion)"],
          ["Bild-URL", "Foto des Gerichts in Karten-Ansicht und Profil"],
          ["Tags", "Mehrfachauswahl aus Tag-Stammdaten (Diät, Eigenschaften)"],
          ["Zusatzstoffe & Allergene", "Länderpflichtige Kennzeichnungscodes — Aggregation aus Rezept-Zutaten plus manuell/KI am Artikel"],
          ["Rezept", "Zutat + Einheit + Menge — verknüpft Bestand für Food-Cost und Kennzeichnungs-Aggregation"],
        ],
      },
    },
    {
      heading: "Zusatzstoffe & Allergene (Kennzeichnungen)",
      body: "Neben den freiform Allergen-Chips gibt es eine länderpflichtige Liste (DE/AT/CH/FR: Zusatzstoffe a–k und EU-Allergene 1–14). Codes pflegst du vor allem an Zutaten im Bestand; am Gericht siehst du die Aggregation aus dem Rezept und kannst zusätzlich manuell oder per KI ergänzen.",
      steps: [
        "Zutaten im Bestand mit „Zusatzstoffe & Allergene“ kennzeichnen (optional KI vorschlagen).",
        "Gericht öffnen — Abschnitt „Zusatzstoffe & Allergene“ zeigt die Aggregation aus dem Rezept.",
        "Optional weitere Codes am Artikel setzen oder per KI vorschlagen lassen (Restaurant-KI, Credits).",
        "Speichern — Codes gehören zum Gericht und den Zutaten.",
      ],
    },
    {
      heading: "Tageskarten",
      body: "Für wechselnde Mittags- oder Wochenangebote legst du pro Datum eine Tageskarte an. Die Stammspeisekarte bleibt unverändert; Gäste sehen am gewählten Tag zusätzlich (oder stattdessen) die Tagesgerichte.",
      steps: [
        "In der Übersicht zur gewünschten Kategorie navigieren.",
        "Tageskarte für ein Datum anlegen.",
        "Gerichte der Tageskarte zuweisen oder direkt dort anlegen.",
        "Am Datum erscheinen die Gerichte automatisch auf Profil und Embed.",
      ],
    },
    {
      heading: "Veröffentlichen und Einbinden",
      body: "Damit Gäste deine Karte sehen, muss dein Restaurant unter Einstellungen → Übersicht veröffentlicht sein. Für die Website: Tab Einbinden liefert den iframe-Code. Für eigene Apps: JSON-API oder MCP unter Einstellungen → API.",
    },
  ],
  tips: [
    "Filter „Eigenschaften“ nutzt die Tag-Stammdaten — lege Tags zuerst über den Tags-Button an.",
    "Tags und „Zusatzstoffe & Allergene“ sind getrennte Abschnitte — keine doppelte Allergen-Pflege im Tag-Feld.",
    "Das Rezept verknüpft Gerichte mit Bestand-Zutaten — Kennzeichnungen und Food-Cost kommen von dort.",
    "Hauptkategorien sind optional, helfen aber bei großen Karten (Speisen / Getränke / Weine).",
  ],
  related: [
    { label: "Bestand (Zutaten)", href: "/docs/handbook/inventory" },
    { label: "Öffentliches Profil", href: "/docs/handbook/public-profile" },
    { label: "Speisekarte API", href: "/docs/api/menu" },
  ],
};
