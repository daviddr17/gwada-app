import type { Metadata } from "next";
import Link from "next/link";
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
        API-Schlüssel — gilt für <code>GET</code> und <code>POST</code> (z. B.
        Reservierung buchen). Für typische Websites (ein Seitenaufruf, gelegentlicher
        Refresh) ist das mehr als ausreichend.
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

      <h2>Häufige Fehler (v1)</h2>
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="px-3 py-2 font-semibold text-foreground">Status</th>
              <th className="px-3 py-2 font-semibold text-foreground">error</th>
              <th className="px-3 py-2 font-semibold text-foreground">Bedeutung</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["401", "invalid_api_key", "Key fehlt, falsch oder widerrufen"],
              ["403", "module_not_enabled", "Modul nicht für diesen Key aktiv"],
              ["403", "origin_forbidden", "Browser-Origin nicht in Allowlist"],
              ["403", "restaurant_not_published", "Restaurant nicht veröffentlicht"],
              ["404", "not_found", "Unbekannter Endpunkt oder keine Daten"],
              ["405", "method_not_allowed", "z. B. POST auf reinem Lese-Modul"],
              ["429", "rate_limit_exceeded", "Limit überschritten (Key oder IP)"],
              ["503", "server_misconfigured", "Serverseitige Konfiguration fehlt"],
            ].map(([status, code, meaning]) => (
              <tr key={code} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                  {status}
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                  {code}
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground">{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Reservierungs-Schreiben kennt zusätzliche Codes (z. B.{" "}
        <code>terms_required</code>, <code>outside_opening_hours</code>,{" "}
        <code>invalid_credentials</code>) — siehe{" "}
        <Link href="/docs/api/reservation">Reservierung</Link>.
      </p>

      <h2>Antwortformat</h2>
      <pre>{`{
  "data": { … }
}`}</pre>
      <p>Fehler:</p>
      <pre>{`{
  "error": "invalid_api_key"
}`}</pre>
      <p>
        Bei <code>429</code> zusätzlich Header <code>Retry-After</code> und oft{" "}
        <code>X-RateLimit-Limit</code>.
      </p>

      <h2>Caching (GET)</h2>
      <ul>
        <li>
          Die meisten Lese-Endpunkte:{" "}
          <code>public, s-maxage=60, stale-while-revalidate=300</code>
        </li>
        <li>
          News und Reservierungs-Schreiben:{" "}
          <code>private, no-cache, no-store, must-revalidate</code>
        </li>
      </ul>
    </DocsProse>
  );
}
