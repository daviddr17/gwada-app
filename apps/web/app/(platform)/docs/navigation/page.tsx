import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Navigation",
  description: "Sidebar, Modul-Tabs und Schnellaktionen in gwada.",
};

export default function DocsNavigationPage() {
  return (
    <DocsProse
      title="Navigation"
      description="So findest du dich in der App zurecht."
    >
      <p>
        gwada ist in wenige wiederkehrende Bereiche gegliedert. Wenn du diese
        Muster kennst, findest du jede Funktion schnell wieder.
      </p>

      <h2>Sidebar (links)</h2>
      <p>Die Sidebar ist dein Hauptmenü:</p>
      <ul>
        <li>
          <strong>Dashboard</strong> — Startseite mit Widgets (immer ganz oben)
        </li>
        <li>
          <strong>Module</strong> — Speisekarte, Bestand, Reservierungen, … (Reihenfolge
          kann angepasst sein)
        </li>
        <li>
          <strong>Einstellungen</strong> — Restaurant, Team, Integrationen (unten in der
          Sidebar)
        </li>
        <li>
          <strong>Changelog</strong> — Was ist neu in gwada
        </li>
      </ul>
      <p>
        Welche Module du siehst, hängt von deinen Berechtigungen ab. Ein
        Mitarbeiter mit eingeschränkter Rolle sieht z. B. nur Checklisten und
        Profil.
      </p>

      <h2>Modul-Tabs (oben)</h2>
      <p>
        Innerhalb eines Moduls wechselst du über <strong>Chips/Tabs</strong> im
        Kopfbereich — z. B. Übersicht · Statistiken · Einbinden · Einstellungen.
        Das Muster ist in fast allen Modulen gleich:
      </p>
      <ul>
        <li>
          <strong>Übersicht</strong> — Hauptarbeit: Liste, Tabelle oder Kalender
        </li>
        <li>
          <strong>Statistiken</strong> — Auswertungen (wo vorhanden)
        </li>
        <li>
          <strong>Einbinden</strong> — Widget für deine Website (öffentliche Module)
        </li>
        <li>
          <strong>Einstellungen</strong> — Modul-spezifische Optionen
        </li>
        <li>
          <strong>Protokoll</strong> — Änderungshistorie (Reservierungen, Dokumente,
          Checklisten)
        </li>
      </ul>

      <h2>Schnellaktionen</h2>
      <p>
        Der runde <strong>Plus-Button</strong> unten rechts (FAB) öffnet häufige
        Anlage-Dialoge — Reservierung, Gericht, Kontakt usw. Welche Aktionen
        erscheinen, stellst du unter{" "}
        <Link href="/docs/handbuch/einstellungen">Einstellungen → Dashboard</Link> ein.
      </p>

      <h2>Listen & Tabellen</h2>
      <p>In den meisten Modulen findest du:</p>
      <ul>
        <li>
          <strong>Suche</strong> — oben in der Toolbar; durchsucht Namen, Titel oder
          Metadaten je nach Modul
        </li>
        <li>
          <strong>Filter</strong> — rundes Filter-Icon öffnet ein Bottom Sheet von
          unten. Optionen sind modulspezifisch (Status, Zeitraum, Lieferant, …).
          „Zurücksetzen“ setzt Standardwerte, „Fertig“ wendet an und schließt.
        </li>
        <li>
          <strong>Plattform-Chips</strong> — bei Nachrichten, Bewertungen, Insights:
          horizontale Chips statt Filter-Sheet (Kanal/Plattform direkt wählen)
        </li>
        <li>
          <strong>Neu anlegen</strong> — breiter Button über der Liste (volle Breite,
          abgerundet)
        </li>
        <li>
          <strong>Bottom Sheets</strong> — Formulare, Detailansichten und Filter
          öffnen sich als Panel von unten; „Abbrechen“ / „Speichern“ unten
        </li>
        <li>
          <strong>Pagination</strong> — „12/45 Einträge · Seite 2/3“ oben und unten bei
          langen Tabellen
        </li>
        <li>
          <strong>Vollbild-Tabelle</strong> — Maximize-Icon oben rechts bei Tabellen
          (Bestand, Dokumente, …)
        </li>
      </ul>

      <h2>Schnellaktionen & Spracheingabe</h2>
      <ul>
        <li>
          <strong>Plus-Button (FAB)</strong> — unten rechts; konfigurierbar unter
          Einstellungen → Dashboard (max. 5 Aktionen)
        </li>
        <li>
          <strong>Mikrofon-FAB</strong> — in Bestand und Reservierungen: Spracheingabe
          für Bestände, Bestellmengen oder neue Reservierungen
        </li>
      </ul>

      <h2>Profil & Restaurants</h2>
      <ul>
        <li>
          <strong>Avatar oben rechts</strong> → Meine Restaurants, Profil, Abmelden
        </li>
        <li>
          <Link href="/docs/handbuch/profil">Profil</Link> — persönliche Einstellungen
        </li>
      </ul>

      <DocsCallout variant="tip">
        Ein Klick auf ein Modul in der Sidebar lädt den Bereich ohne kompletten
        Neustart — du kannst schnell hin und her wechseln.
      </DocsCallout>

      <h2>Superadmin</h2>
      <p>
        Plattform-Administratoren sehen zusätzlich einen Link zu{" "}
        <strong>Superadmin</strong> — dort werden Restaurants, Integrationen und
        Systemeinstellungen für die gesamte Plattform verwaltet. Dieser Bereich ist
        nur für gwada-Betreiber, nicht für Restaurant-Teams.
      </p>
    </DocsProse>
  );
}
