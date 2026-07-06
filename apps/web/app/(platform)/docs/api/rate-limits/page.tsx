import type { Metadata } from "next";
import { DocsProse } from "@/components/docs/docs-prose";
import {
  PUBLIC_API_READ_LIMIT_PER_IP,
  PUBLIC_API_READ_LIMIT_PER_IP_SCOPE,
  PUBLIC_API_WRITE_LIMIT_PER_IP,
  PUBLIC_API_WRITE_LIMIT_PER_IP_SCOPE,
} from "@/lib/api/public-api-rate-limit";
import { RESTAURANT_API_RATE_LIMIT_PER_MINUTE } from "@/lib/api/restaurant-api-rate-limit";

export const metadata: Metadata = {
  title: "Rate Limits",
};

export default function DocsApiRateLimitsPage() {
  return (
    <DocsProse title="Rate Limits & Fehler" description="Limits und HTTP-Antworten.">
      <h2>Public API (Secret-Key, /api/v1/…)</h2>
      <p>
        <strong>{RESTAURANT_API_RATE_LIMIT_PER_MINUTE} Anfragen pro Minute</strong> pro
        API-Schlüssel. Für typische Websites (ein Seitenaufruf, gelegentlicher Refresh)
        ist das mehr als ausreichend.
      </p>
      <p>
        Bei Überschreitung: <code>429 rate_limit_exceeded</code> mit Header{" "}
        <code>Retry-After</code>.
      </p>

      <h2>Öffentliche Slug-Endpunkte (/api/public/…)</h2>
      <p>
        Die unauthentifizierten Embed- und Profil-Routen (Slug in der URL) sind für
        eingebettete Widgets gedacht, nicht für Massen-Scraping. Es gelten zusätzliche
        Limits pro Client-IP:
      </p>
      <ul>
        <li>
          <strong>Lesen (GET):</strong> {PUBLIC_API_READ_LIMIT_PER_IP}/min pro IP,{" "}
          {PUBLIC_API_READ_LIMIT_PER_IP_SCOPE}/min pro IP und Restaurant (Slug bzw.
          Restaurant-ID)
        </li>
        <li>
          <strong>Schreiben (POST):</strong> {PUBLIC_API_WRITE_LIMIT_PER_IP}/min pro IP,{" "}
          {PUBLIC_API_WRITE_LIMIT_PER_IP_SCOPE}/min pro IP und Restaurant
        </li>
      </ul>
      <p>
        Für Headless-Integrationen und höhere Limits:{" "}
        <strong>Public API v1 mit Secret-Key</strong> unter Einstellungen → API.
      </p>
      <p>
        Betroffene Routen u. a.:{" "}
        <code>/api/public/profile/&#123;slug&#125;/&#123;module&#125;</code>,{" "}
        <code>/api/public/embed/&#123;slug&#125;</code>, Reservierung/Kontakt-POST.
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
        <li>
          <code>429 rate_limit_exceeded</code> — Limit überschritten (Key oder IP)
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
