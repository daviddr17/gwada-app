/**
 * Agentic-Browsing / AI-Agents: kurze Maschinen-Zusammenfassung der Plattform.
 * @see https://llmstxt.org/
 */
export const dynamic = "force-static";
export const revalidate = 86400;

const BODY = `# gwada

> Restaurant-Betriebssystem: Speisekarte, Reservierungen, Team, Nachrichten, POS und mehr — ein System für den ganzen Betrieb. Ohne Seat-Fees starten.

Gwada (gwada.app) ist die SaaS-Plattform für Restaurants und Gastro-Betriebe in der DACH-Region.

## Core

- [Startseite](https://gwada.app/): Produktüberblick, Module, Preise
- [Anmelden / Starten](https://gwada.app/login): Zugang zur App
- [Dokumentation](https://gwada.app/docs): Hilfe und Anleitungen

## Legal

- [Impressum](https://gwada.app/impressum)
- [Datenschutz](https://gwada.app/datenschutz)
- [AGB](https://gwada.app/agb)
- [AVV](https://gwada.app/avv)

## Optional

- Öffentliche Restaurant-Profile unter \`https://gwada.app/{slug}\`
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
