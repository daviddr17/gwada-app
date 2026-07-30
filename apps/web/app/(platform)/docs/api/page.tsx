import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import { RESTAURANT_API_MODULES } from "@/lib/api/restaurant-api-modules";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export const metadata: Metadata = {
  title: "API",
  description: "Public API für gwada — Lesen und Reservierungen buchen.",
};

export default function DocsApiPage() {
  return (
    <DocsProse
      title="Public API"
      description="Headless JSON-Zugriff auf veröffentlichte Modul-Daten — ohne iframe. Reservierungen können zusätzlich gebucht werden."
    >
      <p>
        Basis-URL: <code>https://gwada.app/api/v1</code>
      </p>
      <p>
        Schlüssel erzeugst du in der App unter{" "}
        <Link href={APP_ROUTES.settings.api}>Einstellungen → API</Link>. Jeder Schlüssel
        gehört zu genau einem Restaurant und kann pro Modul freigeschaltet werden.
      </p>

      <h2>Module</h2>
      <ul>
        {RESTAURANT_API_MODULES.map((mod) => (
          <li key={mod.id}>
            <Link href={mod.docsPath}>{mod.label}</Link> —{" "}
            <code>GET /api/v1/{mod.path}</code>
            {mod.id === "reservation" ? (
              <>
                {" "}
                · <code>POST /api/v1/reservation</code> ·{" "}
                <code>POST /api/v1/reservation/manage</code>
              </>
            ) : null}
          </li>
        ))}
      </ul>

      <h2>Nächste Schritte</h2>
      <ul>
        <li>
          <Link href="/docs/api/authentication">Authentifizierung</Link>
        </li>
        <li>
          <Link href="/docs/api/rate-limits">Rate Limits</Link>
        </li>
        <li>
          <Link href="/docs/api/reservation">Reservierung buchen</Link>
        </li>
      </ul>
    </DocsProse>
  );
}
