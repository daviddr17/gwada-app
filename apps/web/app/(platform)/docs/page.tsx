import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Dokumentation",
  description: "Guides und API-Referenz für gwada.",
};

export default function DocsPage() {
  return (
    <DocsProse
      title="gwada Dokumentation"
      description="Guides für Einbindung, Integration und Entwicklung."
    >
      <p>
        Hier findest du technische Dokumentation zur Plattform — beginnend mit der{" "}
        <strong>Public Read API</strong> für Headless-Einbindungen.
      </p>
      <h2>API</h2>
      <p>
        JSON-Endpunkte für Speisekarte, Reservierung, News und weitere Module — mit
        API-Schlüssel pro Restaurant. Verwaltung unter{" "}
        <Link href="/settings/api">Einstellungen → API</Link> (Login erforderlich).
      </p>
      <p>
        <Link href="/docs/api">Zur API-Dokumentation →</Link>
      </p>
    </DocsProse>
  );
}
