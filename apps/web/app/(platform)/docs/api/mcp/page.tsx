import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsProse } from "@/components/docs/docs-prose";
import { RESTAURANT_API_MODULES } from "@/lib/api/restaurant-api-modules";
import { RESTAURANT_MCP_TOOLS } from "@/lib/api/restaurant-mcp-tools";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export const metadata: Metadata = {
  title: "MCP",
  description:
    "Restaurant MCP für externe KI-Agenten — Tool-Discovery über /api/v1/mcp.",
};

export default function DocsApiMcpPage() {
  return (
    <DocsProse
      title="Restaurant MCP"
      description="Model Context Protocol über Streamable HTTP — gleiche Schlüssel und Modul-Scopes wie die Public API."
    >
      <p>
        Endpunkt: <code>POST https://gwada.app/api/v1/mcp</code>
      </p>
      <p>
        Externe KI-Agenten (Claude Desktop, Cursor, Custom Hosts) können Tools
        entdecken und aufrufen, ohne REST-Endpunkte manuell zu orchestrieren. Auth
        und Freigaben sind identisch zur{" "}
        <Link href="/docs/api">Public API</Link>: Bearer{" "}
        <code>gwada_sk_live_…</code>, Module pro Key unter{" "}
        <Link href={APP_ROUTES.settings.api}>Einstellungen → API</Link>.
      </p>

      <DocsCallout variant="note" title="Kein Extra-Scope">
        MCP ersetzt die REST-API nicht. Es ist ein Adapter darüber.{" "}
        <code>tools/list</code> liefert nur Tools für Module in{" "}
        <code>enabled_modules</code> — dieselben IDs wie bei REST (
        {RESTAURANT_API_MODULES.map((m) => m.id).join(", ")}).
      </DocsCallout>

      <h2>Schnellstart</h2>
      <ol>
        <li>API-Schlüssel anlegen und Module freischalten</li>
        <li>
          MCP-Client auf <code>https://gwada.app/api/v1/mcp</code> zeigen
        </li>
        <li>
          Header: <code>Authorization: Bearer gwada_sk_live_…</code>,{" "}
          <code>Content-Type: application/json</code>, optional{" "}
          <code>MCP-Protocol-Version: 2025-06-18</code>
        </li>
        <li>
          JSON-RPC: <code>initialize</code> → <code>notifications/initialized</code>{" "}
          → <code>tools/list</code> → <code>tools/call</code>
        </li>
      </ol>

      <h2>Beispiel: Tool-Discovery</h2>
      <pre>{`curl -s -X POST "https://gwada.app/api/v1/mcp" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -H "MCP-Protocol-Version: 2025-06-18" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'`}</pre>
      <p>
        Antwort: <code>result.tools[]</code> mit <code>name</code>,{" "}
        <code>description</code>, <code>inputSchema</code> — nur freigeschaltete
        Module.
      </p>

      <h2>Beispiel: Tool aufrufen</h2>
      <pre>{`curl -s -X POST "https://gwada.app/api/v1/mcp" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Content-Type: application/json" \\
  -H "MCP-Protocol-Version: 2025-06-18" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_menu",
      "arguments": {}
    }
  }'`}</pre>
      <p>
        Erfolg liefert MCP-Content mit JSON unter <code>data</code> (gleiche
        Payloads wie <code>GET /api/v1/…</code>). Fehler im Tool:{" "}
        <code>isError: true</code> und <code>error</code>-Code (z. B.{" "}
        <code>module_not_enabled</code>, <code>restaurant_not_published</code>).
      </p>

      <h2>Tools</h2>
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="px-3 py-2 font-semibold text-foreground">Tool</th>
              <th className="px-3 py-2 font-semibold text-foreground">Modul</th>
              <th className="px-3 py-2 font-semibold text-foreground">REST</th>
            </tr>
          </thead>
          <tbody>
            {RESTAURANT_MCP_TOOLS.map((tool) => {
              const mod = RESTAURANT_API_MODULES.find(
                (m) => m.id === tool.moduleId,
              );
              return (
                <tr
                  key={tool.name}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="px-3 py-2 align-top font-mono text-xs">
                    {tool.name}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {mod ? (
                      <Link href={mod.docsPath}>{mod.label}</Link>
                    ) : (
                      tool.moduleId
                    )}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                    {tool.name === "create_reservation"
                      ? "POST /api/v1/reservation"
                      : tool.name === "manage_reservation"
                        ? "POST /api/v1/reservation/manage"
                        : `GET /api/v1/${mod?.path ?? tool.moduleId}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Protokoll</h2>
      <ul>
        <li>
          Transport: Streamable HTTP (JSON-Antworten; kein SSE nötig für die
          aktuellen Tools)
        </li>
        <li>
          Unterstützte Versionen: <code>2025-06-18</code>, <code>2025-03-26</code>
        </li>
        <li>
          Methoden: <code>initialize</code>, <code>ping</code>,{" "}
          <code>tools/list</code>, <code>tools/call</code>, Notification{" "}
          <code>notifications/initialized</code>
        </li>
        <li>
          Rate-Limit und Origin-Allowlist: wie{" "}
          <Link href="/docs/api/rate-limits">REST</Link>
        </li>
      </ul>

      <h2>Nächste Schritte</h2>
      <ul>
        <li>
          <Link href="/docs/api/authentication">Authentifizierung</Link>
        </li>
        <li>
          <Link href="/docs/api">API-Einstieg</Link>
        </li>
        <li>
          <Link href="/docs/api/reservation">Reservierung buchen</Link>
        </li>
      </ul>
    </DocsProse>
  );
}
