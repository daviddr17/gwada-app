import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsProse } from "@/components/docs/docs-prose";
import { RESTAURANT_API_MODULES } from "@/lib/api/restaurant-api-modules";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export const metadata: Metadata = {
  title: "Authentifizierung",
  description: "Bearer Secret-Key für die Public API /api/v1.",
};

export default function DocsApiAuthenticationPage() {
  return (
    <DocsProse
      title="Authentifizierung"
      description="Bearer Secret-Key — Restaurant wird aus dem Schlüssel abgeleitet."
    >
      <p>
        Sende den API-Schlüssel im Header. Es ist <strong>kein Slug</strong> in der
        URL nötig — das Restaurant ergibt sich aus dem Key. Schlüssel legst du unter{" "}
        <Link href={APP_ROUTES.settings.api}>Einstellungen → API</Link> an.
      </p>
      <pre>{`GET /api/v1/menu
Authorization: Bearer gwada_sk_live_…
Accept: application/json`}</pre>
      <p>
        Für Schreibzugriffe (derzeit nur{" "}
        <Link href="/docs/api/reservation">Reservierung</Link>) dieselbe Auth mit{" "}
        <code>POST</code> und <code>Content-Type: application/json</code>.
      </p>

      <h2>Secret-Key</h2>
      <ul>
        <li>
          Format: <code>gwada_sk_live_…</code>
        </li>
        <li>
          Wird beim Erstellen <strong>nur einmal</strong> im Klartext angezeigt
        </li>
        <li>
          Danach nur noch Prefix sichtbar — bei Verlust neuen Key anlegen und den alten
          widerrufen
        </li>
        <li>
          Funktioniert nur, wenn das Restaurant <strong>veröffentlicht</strong> ist
        </li>
        <li>Key nur serverseitig speichern — nie in öffentlichen Frontend-Bundles</li>
      </ul>

      <DocsCallout variant="tip" title="Server-zu-Server">
        Empfohlen: Aufrufe von deinem Backend aus. Browser-direkt ist möglich, dann
        Origin-Allowlist setzen und den Key nicht committen.
      </DocsCallout>

      <h2>Module pro Key</h2>
      <p>
        Jeder Schlüssel hat eine Modulliste (<code>enabled_modules</code>). Anfragen an
        nicht freigeschaltete Endpunkte antworten mit{" "}
        <code>403 module_not_enabled</code>. Modul-IDs:
      </p>
      <ul>
        {RESTAURANT_API_MODULES.map((mod) => (
          <li key={mod.id}>
            <code>{mod.id}</code> —{" "}
            <Link href={mod.docsPath}>{mod.label}</Link>
          </li>
        ))}
      </ul>

      <h2>Domains (optional)</h2>
      <p>
        Optional kann pro Key eine Origin-Allowlist gesetzt werden (für Browser-Aufrufe
        mit <code>Origin</code>-Header). Server-zu-Server ohne Origin bleibt erlaubt,
        wenn die Liste leer ist. Fremde Origins →{" "}
        <code>403 origin_forbidden</code>.
      </p>

      <h2>Häufige Auth-Fehler</h2>
      <ul>
        <li>
          <code>401 invalid_api_key</code> — fehlt, falsch oder widerrufen
        </li>
        <li>
          <code>403 module_not_enabled</code> — Modul nicht am Key aktiv
        </li>
        <li>
          <code>403 origin_forbidden</code> — Origin nicht erlaubt
        </li>
        <li>
          <code>403 restaurant_not_published</code> — Restaurant nicht veröffentlicht
        </li>
        <li>
          <code>429 rate_limit_exceeded</code> — Limit pro Key — siehe{" "}
          <Link href="/docs/api/rate-limits">Rate Limits</Link>
        </li>
      </ul>
    </DocsProse>
  );
}
