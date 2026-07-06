import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Authentifizierung",
};

export default function DocsApiAuthenticationPage() {
  return (
    <DocsProse
      title="Authentifizierung"
      description="Bearer Secret-Key — Restaurant wird aus dem Schlüssel abgeleitet."
    >
      <p>
        Sende den API-Schlüssel im Header. Es ist <strong>kein Slug</strong> in der
        URL nötig — das Restaurant ergibt sich aus dem Key.
      </p>
      <pre>{`GET /api/v1/menu
Authorization: Bearer gwada_sk_live_…
Accept: application/json`}</pre>

      <h2>Secret-Key</h2>
      <ul>
        <li>Format: <code>gwada_sk_live_…</code></li>
        <li>Wird beim Erstellen <strong>nur einmal</strong> angezeigt</li>
        <li>Danach nur noch Prefix sichtbar — bei Verlust neuen Key anlegen</li>
        <li>Funktioniert nur, wenn das Restaurant <strong>veröffentlicht</strong> ist</li>
      </ul>

      <h2>Module pro Key</h2>
      <p>
        Jeder Schlüssel hat eine Modulliste. Anfragen an nicht freigeschaltete
        Endpunkte antworten mit <code>403 module_not_enabled</code>.
      </p>

      <h2>Domains (optional)</h2>
      <p>
        Optional kann pro Key eine Origin-Allowlist gesetzt werden (für Browser-Aufrufe).
        Server-zu-Server ohne <code>Origin</code>-Header bleibt erlaubt, wenn die Liste
        leer ist. Details:{" "}
        <Link href="/docs/api/rate-limits">Rate Limits &amp; Fehler</Link>.
      </p>
    </DocsProse>
  );
}
