import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Reservierung",
  description: "Public API: Reservierungsdaten lesen und online buchen.",
};

export default function DocsApiReservationPage() {
  return (
    <DocsProse
      title="Reservierung"
      description="Restaurant-Konfiguration lesen sowie Reservierungen buchen und verwalten."
    >
      <p>
        Modul-ID im API-Schlüssel: <code>reservation</code>. Das Restaurant wird aus
        dem Schlüssel abgeleitet — <strong>kein Slug</strong> im Body nötig (wird
        serverseitig gesetzt).
      </p>

      <h2>Lesen</h2>
      <p>
        Endpunkt: <code>GET /api/v1/reservation</code>
      </p>
      <pre>{`curl -s "https://gwada.app/api/v1/reservation" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Accept: application/json"`}</pre>
      <p>
        Antwort: öffentliche Buchungs-Konfiguration — gleiche Struktur wie das
        Embed-Widget. Cache:{" "}
        <code>public, s-maxage=60, stale-while-revalidate=300</code>.
      </p>
      <pre>{`{
  "data": {
    "id": "uuid",
    "name": "Restaurant Name",
    "slug": "mein-slug",
    "accentHex": "#c45c26",
    "timezone": "Europe/Berlin",
    "defaultDwellMinutes": 120,
    "bookingLeadTimeHours": 0,
    "minMinutesBeforeClosing": 60,
    "embedFormFooterText": null,
    "weeklyHours": { "monday": { "closed": false, "open": "11:30", "close": "22:00" } },
    "dateExceptions": []
  }
}`}</pre>
      <p>
        Nutze <code>defaultDwellMinutes</code>, um <code>ends_at</code> zu berechnen,
        wenn der Gast nur Startzeit wählt. <code>bookingLeadTimeHours</code> und
        Öffnungszeiten/Ausnahmen bestimmen die Buchbarkeit.
      </p>

      <h2>Buchen</h2>
      <p>
        Endpunkt: <code>POST /api/v1/reservation</code>
      </p>
      <pre>{`curl -s -X POST "https://gwada.app/api/v1/reservation" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "guest_first_name": "Anna",
    "guest_last_name": "Muster",
    "guest_phone": "+491701234567",
    "guest_email": null,
    "party_size": 2,
    "starts_at": "2026-08-01T18:00:00.000Z",
    "ends_at": "2026-08-01T20:00:00.000Z",
    "notify_email": false,
    "notify_whatsapp": true,
    "terms_accepted": true
  }'`}</pre>
      <p>Erfolg (<code>200</code>):</p>
      <pre>{`{
  "data": {
    "reservation_number": 42,
    "guest_pin": "1234"
  }
}`}</pre>
      <p>
        Pflicht: Nachname, mind. ein Kontaktkanal (Telefon oder E-Mail), mind. ein
        Benachrichtigungskanal, <code>terms_accepted: true</code>. Zeiten müssen
        innerhalb der öffentlichen Buchbarkeit liegen.
      </p>

      <h2>Verwalten (laden / ändern)</h2>
      <p>
        Endpunkt: <code>POST /api/v1/reservation/manage</code>
      </p>
      <p>
        Mit <code>action: &quot;load&quot;</code> die Reservierung laden (Gast-Ansicht ohne
        interne IDs). Ohne Action bzw. mit Update-Feldern: Änderung einreichen
        (ggf. als Änderungswunsch).
      </p>
      <pre>{`curl -s -X POST "https://gwada.app/api/v1/reservation/manage" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "load",
    "reservation_number": 42,
    "pin": "1234"
  }'`}</pre>
      <p>Laden liefert u. a. Gastname, Party-Size, Zeiten und Status unter{" "}
        <code>data.reservation</code>.
      </p>
      <pre>{`curl -s -X POST "https://gwada.app/api/v1/reservation/manage" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "reservation_number": 42,
    "pin": "1234",
    "guest_first_name": "Anna",
    "guest_last_name": "Muster",
    "guest_phone": "+491701234567",
    "guest_email": null,
    "party_size": 3,
    "starts_at": "2026-08-01T19:00:00.000Z",
    "ends_at": "2026-08-01T21:00:00.000Z",
    "notify_email": false,
    "notify_whatsapp": true,
    "terms_accepted": true
  }'`}</pre>

      <h2>Typische Schreib-Fehler</h2>
      <ul>
        <li>
          <code>400 terms_required</code> / <code>last_name_required</code> /{" "}
          <code>contact_required</code> / <code>notify_channel_required</code>
        </li>
        <li>
          <code>400 booking_lead_time</code> / <code>outside_opening_hours</code>
        </li>
        <li>
          <code>401 invalid_credentials</code> — falsche Nummer/PIN beim Manage
        </li>
        <li>
          <code>403 not_editable</code> — storniert / abgelehnt / no-show
        </li>
      </ul>
      <p>
        Bei erfolgreicher Änderung:{" "}
        <code>{`{ "data": { "ok": true, "change_request": false } }`}</code>.{" "}
        <code>change_request: true</code>, wenn der Status nicht mehr{" "}
        <code>pending</code> ist und ein Änderungswunsch angelegt wurde.
      </p>

      <h2>Hinweise</h2>
      <ul>
        <li>
          Schreib-Antworten sind <code>Cache-Control: private, no-cache, …</code>
        </li>
        <li>
          CORS erlaubt <code>GET</code>, <code>POST</code>, <code>OPTIONS</code>
        </li>
        <li>
          Gleiche Validierung wie das öffentliche Buchungsformular (Vorlauf,
          Öffnungszeiten, …)
        </li>
        <li>
          Auth &amp; Limits:{" "}
          <Link href="/docs/api/authentication">Authentifizierung</Link>,{" "}
          <Link href="/docs/api/rate-limits">Rate Limits</Link>
        </li>
      </ul>
    </DocsProse>
  );
}
