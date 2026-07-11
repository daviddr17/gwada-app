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
  { label: "Navigation", href: "/docs/navigation", text: "Sidebar, Tabs, Listen, Schnellaktionen" },
  { label: "Dashboard", href: "/docs/handbuch/dashboard", text: "Widgets und Tagesüberblick" },
  { label: "Einstellungen", href: "/docs/handbuch/einstellungen", text: "Team, Integrationen, Displays" },
];

export default function DocsPage() {
  return (
    <DocsProse
      title="gwada Dokumentation"
      description="Handbuch für Restaurant-Teams und technische Referenz für Entwickler."
    >
      <p>
        Willkommen in der gwada-Dokumentation. Hier findest du Anleitungen für alle
        Module der App — verständlich formuliert, ohne technisches Vorwissen.
      </p>

      <DocsCallout variant="note" title="Text statt Screenshots">
        Die Docs folgen bewusst dem Muster moderner Hilfe-Center (kurze Abschnitte,
        klare Schritte, Tabellen). So bleiben sie auch nach UI-Updates aktuell.
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
      <p>Jedes Modul hat eine eigene Seite mit Bereichen, typischen Aufgaben und Tipps:</p>
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
