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
        Jede Handbuch-Seite erklärt Tabs, Toolbar, Filter (Bottom Sheet), Formulare
        und typische Abläufe — inklusive Tipps und Querverweisen zu verwandten Modulen:
      </p>
      <ul>
        {USER_GUIDE_PAGES.map((page) => (
          <li key={page.slug}>
            <Link href={`/docs/handbuch/${page.slug}`}>{page.title}</Link> —{" "}
            {page.description}
          </li>
        ))}
      </ul>

      <h2>So nutzt du die Docs auf dem Handy</h2>
      <p>
        Oben rechts öffnet <strong>Inhalt</strong> das Inhaltsverzeichnis. Abschnitte
        (Erste Schritte, Handbuch, API) lassen sich einklappen — standardmäßig ist nur
        der aktive Bereich ausgeklappt.
      </p>

      <h2>API (Entwickler)</h2>
      <p>
        Für Headless-Einbindungen und eigene Frontends: JSON-Endpunkte mit
        API-Schlüssel pro Restaurant. Starte mit Authentifizierung und Rate Limits,
        danach Modul-Endpunkte.
      </p>
      <ul>
        <li>
          <Link href="/docs/api">API-Einstieg</Link>
        </li>
        <li>
          <Link href="/docs/api/authentication">Authentifizierung</Link>
        </li>
        <li>
          <Link href="/docs/api/reservation">Reservierung (ausführlich)</Link>
        </li>
      </ul>
    </DocsProse>
  );
}
