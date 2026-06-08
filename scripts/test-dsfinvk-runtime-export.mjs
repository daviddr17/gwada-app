#!/usr/bin/env node
/**
 * Verifies runtime DSFinV-K export (Fiskaly list → download), no server storage.
 * Usage: node scripts/test-dsfinvk-runtime-export.mjs [sessionId]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appendFileSync } from "node:fs";

const LOG_PATH = resolve(".cursor/debug-c97642.log");
const SESSION_ID = "c97642";

function agentLog(message, data, hypothesisId = "verify") {
  const line = JSON.stringify({
    sessionId: SESSION_ID,
    runId: "post-fix",
    hypothesisId,
    location: "scripts/test-dsfinvk-runtime-export.mjs",
    message,
    data,
    timestamp: Date.now(),
  });
  try {
    appendFileSync(LOG_PATH, `${line}\n`);
  } catch {
    /* ignore */
  }
}

const envPath = resolve("apps/web/.env.local");
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("Missing apps/web/.env.local");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

function berlinBusinessDate(closedAtIso) {
  return new Date(closedAtIso).toLocaleDateString("en-CA", {
    timeZone: "Europe/Berlin",
  });
}

const sessionIdArg = process.argv[2]?.trim();

let sessionQuery = `${url}/rest/v1/pos_register_sessions?closed_at=not.is.null&select=id,restaurant_id,closed_at,cash_point_closing_id,dsfinvk_business_date,z_nr&order=closed_at.desc&limit=1`;
if (sessionIdArg) {
  sessionQuery = `${url}/rest/v1/pos_register_sessions?id=eq.${sessionIdArg}&select=id,restaurant_id,closed_at,cash_point_closing_id,dsfinvk_business_date,z_nr&limit=1`;
}

const sessions = await fetch(sessionQuery, { headers }).then((r) => r.json());
const session = sessions[0];
if (!session) {
  console.error("No closed session found");
  agentLog("no_session", {});
  process.exit(1);
}

agentLog("session_loaded", {
  sessionId: session.id,
  zNr: session.z_nr,
  hasClosingId: Boolean(session.cash_point_closing_id),
  hasBusinessDate: Boolean(session.dsfinvk_business_date),
});

const [platformRows, fiscalRows] = await Promise.all([
  fetch(
    `${url}/rest/v1/platform_integrations?key=eq.fiskaly&select=enabled,config`,
    { headers },
  ).then((r) => r.json()),
  fetch(
    `${url}/rest/v1/pos_restaurant_fiscal_config?restaurant_id=eq.${session.restaurant_id}&select=fiskaly_client_id`,
    { headers },
  ).then((r) => r.json()),
]);

const platform = platformRows[0];
const fiscal = fiscalRows[0];
const cfg = platform?.config ?? {};
const apiKey = cfg.api_key?.trim();
const apiSecret = cfg.api_secret?.trim();
let dsfinvkBase = (
  cfg.dsfinvk_base_url ?? "https://dsfinvk.fiskaly.com/api/v1"
).replace(/\/$/, "");
if (dsfinvkBase.includes("kassensichv-middleware")) {
  dsfinvkBase = "https://dsfinvk.fiskaly.com/api/v1";
}
const clientId = fiscal?.fiskaly_client_id?.trim();

if (!platform?.enabled || !apiKey || !apiSecret || !clientId) {
  console.error("Fiskaly not configured for restaurant");
  agentLog("fiskaly_not_configured", { enabled: Boolean(platform?.enabled) });
  process.exit(1);
}

const businessDate =
  session.dsfinvk_business_date?.slice(0, 10) ??
  berlinBusinessDate(session.closed_at);

agentLog("fiskaly_query", { businessDate, clientIdPrefix: clientId.slice(0, 8) });

const authRes = await fetch(`${dsfinvkBase}/auth`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
});
const authBody = await authRes.json().catch(() => ({}));
if (!authRes.ok) {
  console.error("DSFinV-K auth failed", authRes.status);
  agentLog("auth_failed", { status: authRes.status });
  process.exit(1);
}

const token = authBody.access_token;
const listUrl = new URL(`${dsfinvkBase}/exports`);
listUrl.searchParams.set("client_id", clientId);
listUrl.searchParams.set("business_date_start", businessDate);
listUrl.searchParams.set("business_date_end", businessDate);
listUrl.searchParams.set("states", "COMPLETED");

const listRes = await fetch(listUrl, {
  headers: { Authorization: `Bearer ${token}` },
});
const listBody = await listRes.json().catch(() => ({}));
const exports = Array.isArray(listBody?.data) ? listBody.data : [];

agentLog("list_exports", {
  listOk: listRes.ok,
  status: listRes.status,
  count: exports.length,
});

if (!listRes.ok) {
  console.error("List exports failed", listRes.status, listBody);
  process.exit(1);
}

const closingId = session.cash_point_closing_id?.toLowerCase?.();
const completed = exports.filter((e) => (e.state ?? "").toUpperCase() === "COMPLETED");
const match =
  (closingId
    ? completed.find((e) =>
        (e.cash_point_closings ?? []).some(
          (c) => String(c).toLowerCase() === closingId,
        ),
      )
    : null) ?? completed[0];

const exportId = match?._id ?? match?.id;
if (!exportId) {
  console.error("No COMPLETED export for session", session.id, "date", businessDate);
  agentLog("no_export_match", { completedCount: completed.length });
  process.exit(1);
}

agentLog("export_matched", { exportId, source: "fiskaly_list" });

const dlRes = await fetch(`${dsfinvkBase}/exports/${exportId}/download`, {
  headers: { Authorization: `Bearer ${token}` },
});
const buf = Buffer.from(await dlRes.arrayBuffer());

agentLog("download_result", {
  status: dlRes.status,
  zipBytes: buf.length,
  contentType: dlRes.headers.get("content-type"),
  isZip: buf[0] === 0x50 && buf[1] === 0x4b,
});

if (!dlRes.ok || buf.length < 100) {
  console.error("Download failed", dlRes.status, "bytes", buf.length);
  process.exit(1);
}

console.log(
  `OK runtime export Z${session.z_nr ?? "?"} session=${session.id} zip=${buf.length} bytes export=${exportId}`,
);
process.exit(0);
