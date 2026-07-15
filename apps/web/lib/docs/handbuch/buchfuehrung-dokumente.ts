import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export const buchfuehrungGuide: UserGuidePage = {
  slug: "buchfuehrung",
  title: "Buchführung",
  description:
    "Rechnungen, Angebote, Belege, Kassenbuch, Lexware und Statistiken.",
  intro: [
    "Buchführung unterstützt dich bei Rechnungsstellung, Angeboten, Belegarchiv und Kassenbuch. Optional verbindest du Lexware für automatischen Beleg-Abgleich. Für gesetzeskonforme Kassensysteme (TSE) gibt es separate Einstellungen unter Einstellungen → Kasse.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Rechnungen", "Ausgangsrechnungen erstellen und verwalten"],
          ["Angebote", "Angebote an Kunden — umwandelbar in Rechnungen"],
          ["Belege", "Eingangs- und Ausgangsbelege archivieren"],
          ["Kasse", "Kassenbuch — Einnahmen und Ausgaben erfassen"],
          ["Statistiken", "Umsatz, Belege, Auswertungen"],
          ["Einstellungen", "Steuer, Nummernkreise, Katalog, Lexware"],
        ],
      },
    },
    {
      heading: "Gemeinsame Filter (Bottom Sheet)",
      table: {
        headers: ["Filter", "Bedeutung"],
        rows: [
          ["Quelle", "Alle / Gwada / Lexware — Lexware nur wenn verbunden"],
          ["Status", "Entwurf, Offen, Bezahlt, Storniert, … je nach Dokumenttyp"],
          ["Belegart (Belege)", "Ausgabe, Einkauf, Einnahme, Verkauf"],
          ["Dokumenttyp", "Standard, Korrektur, Gutschrift"],
        ],
      },
    },
    {
      heading: "Rechnungen & Angebote",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Neue Rechnung / Neues Angebot", "Bottom Sheet mit Live-Vorschau"],
          ["Kontakt", "Bestehender Kontakt aus Adressbuch oder Neuanlage"],
          ["Positionen", "Artikel, Menge, Einzelpreis, Steuersatz"],
          ["Als Entwurf speichern", "Noch nicht final — bearbeitbar"],
          ["Abschließen", "Rechnungsnummer vergeben, PDF erzeugen"],
          ["Versenden", "E-Mail an Kunden (wenn konfiguriert)"],
        ],
      },
    },
    {
      heading: "Belege",
      body: "Eingangsbelege (Lieferantenrechnungen) und Ausgangsbelege hochladen. Bei Lexware-Verbindung können Belege synchronisiert werden — Lexware-Belege sind in Gwada meist read-only.",
      items: [
        "Belegupload — PDF oder Bild",
        "Belegdatum und Belegnummer",
        "Betrag und Steuer",
        "Lexware-Sync — Abruf neuer Belege von Lexware",
      ],
    },
    {
      heading: "Kasse (Kassenbuch)",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Buchung erfassen", "Manuelle Einnahme oder Ausgabe"],
          ["Anfangsbestand", "Kassenstand zu Beginn eines Zeitraums"],
          ["Kategorien", "Zuordnung für Statistiken"],
        ],
      },
    },
    {
      heading: "Stammdaten (Toolbar)",
      body: "In Rechnungen/Belegen erreichst du über die Toolbar den Katalog: Artikel, Steuersätze, Zahlungsbedingungen und Status — Grundlage für Positionen in Dokumenten.",
    },
  ],
  tips: [
    "Lexware-Verbindung richtest du unter Integrationen ein — danach erscheint Quelle „Lexware“ in Filtern.",
    "Fiskaly TSE (Kassensicherungsverordnung) ist unter Einstellungen → Kasse, nicht im Kassenbuch-Tab.",
  ],
  related: [
    { label: "Integrationen → Lexware", href: "/docs/handbuch/integrationen" },
    { label: "Kontakte", href: "/docs/handbuch/nachrichten" },
    { label: "Einstellungen", href: "/docs/handbuch/einstellungen" },
  ],
};

export const dokumenteGuide: UserGuidePage = {
  slug: "dokumente",
  title: "Dokumente",
  description: "Dateien ablegen, versionieren, suchen und protokollieren.",
  intro: [
    "Dokumente ist deine zentrale Ablage für Verträge, Zertifikate, Hygieneunterlagen, Behördenbriefe und andere Dateien — mit Versionshistorie und Änderungsprotokoll.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Alle Dokumente — Suche, Filter, Pagination"],
          ["Statistiken", "Übersicht nach Dokumenttypen"],
          ["Protokoll", "Wer hat wann welches Dokument geändert"],
        ],
      },
    },
    {
      heading: "Buttons und Filter",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Neues Dokument", "Datei hochladen mit Titel und optional Kategorie"],
          ["Suche", "Titel und Metadaten durchsuchen"],
          ["Filter", "Bottom Sheet: Kategorie, Zeitraum, …"],
          ["Pagination", "x/y Dokumente · Seite — oben und unten"],
          ["Vollbild-Tabelle", "Maximize-Icon für große Listen"],
        ],
      },
    },
    {
      heading: "Versionen",
      body: "Lädst du eine neue Version hoch, ersetzt sie die aktuelle Datei. Ältere Versionen bleiben im Protokoll nachvollziehbar — wichtig für Audits und HACCP.",
    },
  ],
  related: [
    { label: "Mitarbeiter → Dokumente", href: "/docs/handbuch/mitarbeiter" },
    { label: "Checklisten", href: "/docs/handbuch/checklisten" },
  ],
};
