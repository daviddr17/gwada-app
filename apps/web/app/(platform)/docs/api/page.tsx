import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout } from "@/components/docs/docs-callout";
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
      description="Headless JSON-Zugriff auf veröffentlichte Modul-Daten — ohne iframe. Reservierungen können zusätzlich gebucht und verwaltet werden."
    >
      <p>
        Basis-URL: <code>https://gwada.app/api/v1</code>
      </p>
      <p>
        Schlüssel erzeugst du in der App unter{" "}
        <Link href={APP_ROUTES.settings.api}>Einstellungen → API</Link>. Jeder Schlüssel
        gehört zu genau einem Restaurant und kann pro Modul freigeschaltet werden. Das
        Restaurant wird aus dem Key abgeleitet — kein Slug in der URL nötig.
      </p>

      <DocsCallout variant="note" title="Antwortformat">
        Erfolg: <code>{`{ "data": … }`}</code>. Fehler:{" "}
        <code>{`{ "error": "…" }`}</code>. Details zu Limits und Codes:{" "}
        <Link href="/docs/api/rate-limits">Rate Limits &amp; Fehler</Link>.
      </DocsCallout>

      <h2>Schnellstart</h2>
      <ol>
        <li>
          Restaurant unter Einstellungen veröffentlichen
        </li>
        <li>
          API-Schlüssel anlegen und benötigte Module freischalten
        </li>
        <li>
          Key sicher speichern (wird nur einmal im Klartext gezeigt)
        </li>
        <li>
          <code>GET /api/v1/…</code> mit{" "}
          <code>Authorization: Bearer gwada_sk_live_…</code> aufrufen
        </li>
      </ol>

      <h2>Module</h2>
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="px-3 py-2 font-semibold text-foreground">Modul</th>
              <th className="px-3 py-2 font-semibold text-foreground">Endpunkte</th>
              <th className="px-3 py-2 font-semibold text-foreground">Key-ID</th>
            </tr>
          </thead>
          <tbody>
            {RESTAURANT_API_MODULES.map((mod) => (
              <tr
                key={mod.id}
                className="border-b border-border/40 last:border-0"
              >
                <td className="px-3 py-2 align-top">
                  <Link href={mod.docsPath}>{mod.label}</Link>
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                  <div>GET /api/v1/{mod.path}</div>
                  {mod.id === "reservation" ? (
                    <>
                      <div>POST /api/v1/reservation</div>
                      <div>POST /api/v1/reservation/manage</div>
                    </>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                  {mod.id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>CORS</h2>
      <p>
        Browser-Aufrufe: <code>OPTIONS</code> preflight mit{" "}
        <code>Access-Control-Allow-Methods: GET, POST, OPTIONS</code> und{" "}
        <code>Allow-Headers: Authorization, Content-Type</code>. Optional Origin-Allowlist
        pro Key — siehe Authentifizierung.
      </p>

      <h2>Nächste Schritte</h2>
      <ul>
        <li>
          <Link href="/docs/api/authentication">Authentifizierung</Link>
        </li>
        <li>
          <Link href="/docs/api/rate-limits">Rate Limits &amp; Fehler</Link>
        </li>
        <li>
          <Link href="/docs/api/menu">Speisekarte lesen</Link>
        </li>
        <li>
          <Link href="/docs/api/reservation">Reservierung buchen</Link>
        </li>
      </ul>
    </DocsProse>
  );
}
