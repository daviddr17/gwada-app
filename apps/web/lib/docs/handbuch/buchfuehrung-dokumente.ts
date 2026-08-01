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
  description:
    "Zentrale Ablage für Verträge, Zertifikate und Unterlagen — mit Tags, Mitarbeiter-Zuordnung und Änderungsprotokoll.",
  intro: [
    "Dokumente ist deine Ablage für Verträge, Zertifikate, Hygieneunterlagen, Behördenbriefe und andere Dateien. Jeder Upload kann optional einem Mitarbeiter und einem Tag zugeordnet werden — und jede Änderung landet im Protokoll.",
    "Die Übersicht ist eine paginierte Tabelle: Suche, Tag-Filter und Spalten-Sortierung helfen auch bei vielen Dateien den Überblick zu behalten.",
  ],
  sections: [
    {
      heading: "Tabs im Modul",
      table: {
        headers: ["Tab", "Zweck"],
        rows: [
          ["Übersicht", "Alle Dokumente — Suche, Tag-Filter, Sortierung, Pagination"],
          ["Statistiken", "Verteilung und Kennzahlen zu Dokumenten"],
          ["Protokoll", "Wer hat wann welches Dokument angelegt oder geändert"],
        ],
      },
    },
    {
      heading: "Toolbar und Aktionen",
      table: {
        headers: ["Element", "Bedeutung"],
        rows: [
          ["Neues Dokument", "Upload-Drawer — volle Breite über der Liste"],
          ["Drag & Drop", "Datei auf die Seite ziehen öffnet ebenfalls den Upload"],
          ["Tags", "Dokument-Tags verwalten (anlegen, umbenennen, löschen)"],
          ["Suche", "Titel, Dateiname oder Tag durchsuchen"],
          ["Tag-Filter", "Alle Tags / Ohne Tag / einzelner Tag"],
          ["Spalten-Sortierung", "Titel, Dateiname, Tag, Uploader, Größe, Datum"],
          ["Pagination", "x/y Dokumente · Seite — oben und unten identisch"],
          ["Vollbild-Tabelle", "Maximize-Icon für große Listen"],
        ],
      },
    },
    {
      heading: "Dokument hochladen",
      steps: [
        "Dokumente → Übersicht → Neues Dokument (oder Datei auf die Seite ziehen).",
        "Datei wählen.",
        "Titel vergeben — klar und wiederfindbar (z. B. „HACCP-Protokoll 2026“).",
        "Optional Tag zuweisen und optional Mitarbeiter verknüpfen (Personalakte).",
        "Hochladen — der Eintrag erscheint in der Übersicht und im Protokoll.",
      ],
    },
    {
      heading: "Bearbeiten und Notizen",
      body: "Ein Tipp auf eine Zeile öffnet den Detail-Drawer. Dort kannst du Metadaten anpassen und Notizen hinterlegen. Notiz-Änderungen werden protokolliert — wichtig, wenn mehrere Personen Zugriff haben.",
      items: [
        "Titel und Tag nachträglich ändern",
        "Mitarbeiter-Zuordnung setzen oder entfernen",
        "Notizen für Kontext (z. B. „gültig bis …“, „Kopie an Steuerberater“)",
        "Dokument löschen — mit Bestätigung",
      ],
    },
    {
      heading: "Protokoll",
      body: "Im Tab Protokoll siehst du die Historie über alle Dokumente. Zusätzlich kannst du pro Dokument das Einzelprotokoll aus der Zeile öffnen. Suche nach Dokument, Nutzer oder Aktion.",
    },
    {
      heading: "Mitarbeiter-Dokumente vs. Modul Dokumente",
      body: "Personalunterlagen (Verträge, Gehaltszettel) liegen oft auch unter Mitarbeiter → Dokumente bzw. im Mitarbeiter-Profil. Das Modul Dokumente ist die betriebliche Ablage für alle — inkl. HACCP, Behörden und allgemeiner Verträge.",
    },
  ],
  tips: [
    "Lege Tags früh an (z. B. HACCP, Behörde, Vertrag) — später filterst du schneller.",
    "Mitarbeiter-Zuordnung hilft bei Personalakten, ist aber optional.",
    "URL-Parameter ?new=1 öffnet den Upload-Drawer direkt — nützlich für Bookmarks oder Schnellaktionen.",
  ],
  related: [
    { label: "Mitarbeiter → Dokumente", href: "/docs/handbuch/mitarbeiter" },
    { label: "Checklisten", href: "/docs/handbuch/checklisten" },
    { label: "Buchführung", href: "/docs/handbuch/buchfuehrung" },
  ],
};
