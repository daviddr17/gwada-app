import type { Metadata } from "next";
import { DocsProse } from "@/components/docs/docs-prose";
import { RESTAURANT_API_RATE_LIMIT_PER_MINUTE } from "@/lib/api/restaurant-api-rate-limit";

export const metadata: Metadata = {
  title: "Rate Limits",
};

export default function DocsApiRateLimitsPage() {
  return (
    <DocsProse title="Rate Limits & Fehler" description="Limits und HTTP-Antworten.">
      <h2>Rate Limit</h2>
      <p>
        <strong>{RESTAURANT_API_RATE_LIMIT_PER_MINUTE} Anfragen pro Minute</strong> pro
        API-Schlüssel. Für typische Websites (ein Seitenaufruf, gelegentlicher Refresh)
        ist das mehr als ausreichend.
      </p>
      <p>
        Bei Überschreitung: <code>429 rate_limit_exceeded</code> mit Header{" "}
        <code>Retry-After</code>.
      </p>

      <h2>Häufige Fehler</h2>
      <ul>
        <li>
          <code>401 invalid_api_key</code> — Key fehlt, falsch oder widerrufen
        </li>
        <li>
          <code>403 module_not_enabled</code> — Modul nicht für diesen Key aktiv
        </li>
        <li>
          <code>403 origin_forbidden</code> — Browser-Origin nicht in Allowlist
        </li>
        <li>
          <code>403 restaurant_not_published</code> — Restaurant nicht veröffentlicht
        </li>
        <li>
          <code>404 not_found</code> — unbekannter Endpunkt oder keine Daten
        </li>
      </ul>

      <h2>Antwortformat</h2>
      <pre>{`{
  "data": { … }
}`}</pre>
      <p>Fehler:</p>
      <pre>{`{
  "error": "invalid_api_key"
}`}</pre>
    </DocsProse>
  );
}
