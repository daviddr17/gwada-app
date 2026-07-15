import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsProse } from "@/components/docs/docs-prose";
import { USER_GUIDE_PAGES } from "@/lib/docs/user-guide-content";

export const metadata: Metadata = {
  title: "Dokumentation",
  description: "Handbuch und API-Referenz für gwada.",
};

const QUICK_START = [
  { label: "Erste Schritte", href: "/docs/erste-schritte", text: "Anmeldung, Restaurant wählen, loslegen" },
  { label: "Navigation", href: "/docs/navigation", text: "Sidebar, Tabs, Filter, Bottom Sheets" },
  { label: "Dashboard", href: "/docs/handbuch/dashboard", text: "Widgets, Heute-Briefing, Schnellaktionen" },
  { label: "Integrationen", href: "/docs/handbuch/integrationen", text: "WhatsApp, Google, Meta, Lexware" },
  { label: "Einstellungen", href: "/docs/handbuch/einstellungen", text: "Team, Displays, API" },
];

export default function DocsPage() {
  return (
    <DocsProse
      title="gwada Dokumentation"
      description="Handbuch für Restaurant-Teams und technische Referenz für Entwickler."
    >
      <p>
        Willkommen in der gwada-Dokumentation. Hier findest du ausführliche Anleitungen
        für alle Module — inklusive Erklärung jedes Tabs, Buttons, Filters und
        typischer Workflows. Die Docs richten sich an Inhaber, Manager und Mitarbeiter
        ohne technisches Vorwissen.
      </p>

      <DocsCallout variant="note" title="Text statt Screenshots">
        Die Docs folgen bewusst dem Muster moderner Hilfe-Center: Tabellen für Buttons
        und Filter, nummerierte Schritte für Aufgaben, Querverweise zwischen Modulen.
        So bleiben sie auch nach UI-Updates aktuell — Menübezeichnungen entsprechen
        der App.
      </DocsCallout>

      <h2>Schnellstart</h2>
      <ul>
        {QUICK_START.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link> — {item.text}
          </li>
        ))}
      </ul>

      <h2>Module</h2>
      <p>
        Jedes Modul hat eine eigene Handbuch-Seite mit: Tabs und Bereichen, Buttons
        und Toolbar-Elementen, Filter-Optionen (Bottom Sheet), Formularfeldern und
        typischen Abläufen:
      </p>
      <ul>
        {USER_GUIDE_PAGES.map((page) => (
          <li key={page.slug}>
            <Link href={`/docs/handbuch/${page.slug}`}>{page.title}</Link>
          </li>
        ))}
      </ul>

      <h2>API (Entwickler)</h2>
      <p>
        Für Headless-Einbindungen und eigene Frontends: JSON-Endpunkte mit
        API-Schlüssel pro Restaurant.
      </p>
      <p>
        <Link href="/docs/api">Zur API-Dokumentation →</Link>
      </p>
    </DocsProse>
  );
}
