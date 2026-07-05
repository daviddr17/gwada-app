#!/usr/bin/env node
/**
 * WAHA-Sessions nach Domain-Cutover: Webhook-URL auf gwada.app aktualisieren.
 * Usage: dotenv -e .env.production -- node scripts/refresh-waha-webhooks-live.mjs
 */
import { createClient } from "@supabase/supabase-js";

const LIVE_ORIGIN = (process.env.GWADA_LIVE_ORIGIN ?? "https://gwada.app").replace(
  /\/+$/,
  "",
);
const WEBHOOK_URL = `${LIVE_ORIGIN}/api/integrations/waha/webhook`;

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Env ${name} fehlt`);
  return v;
}

function wahaSessionName(restaurantId) {
  const compact = restaurantId.replace(/[^a-zA-Z0-9]/g, "");
  return `gwada${compact.slice(0, 48)}`;
}

function sessionConfig(restaurantId) {
  return {
    webhooks: [{ url: WEBHOOK_URL, events: ["message", "message.ack"] }],
    metadata: { "gwada.restaurant_id": restaurantId },
    webjs: { tagsEventsOn: true },
  };
}

async function main() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: platform, error: pErr } = await admin
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "whatsapp")
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);

  const cfg = platform?.config ?? {};
  const baseUrl = String(cfg.waha_base_url ?? "")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = String(cfg.waha_api_key ?? "").trim();
  if (!baseUrl || !apiKey) {
    console.log("WAHA nicht konfiguriert — übersprungen.");
    return;
  }

  const { data: integrations, error: iErr } = await admin
    .from("restaurant_integrations")
    .select("restaurant_id, status")
    .eq("integration_key", "whatsapp")
    .in("status", ["working", "scan_qr", "starting"]);
  if (iErr) throw new Error(iErr.message);

  const ids = [...new Set((integrations ?? []).map((r) => r.restaurant_id))];
  console.log(`WAHA ${baseUrl} — ${ids.length} Session(s), Webhook → ${WEBHOOK_URL}`);

  let ok = 0;
  let fail = 0;
  for (const restaurantId of ids) {
    const sessionName = wahaSessionName(restaurantId);
    const res = await fetch(
      `${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({ config: sessionConfig(restaurantId) }),
      },
    );
    if (res.ok) {
      console.log(`  ✓ ${sessionName}`);
      ok += 1;
    } else {
      const body = (await res.text()).slice(0, 120);
      console.warn(`  ✗ ${sessionName} HTTP ${res.status} ${body}`);
      fail += 1;
    }
  }

  console.log(`Fertig: ${ok} aktualisiert, ${fail} fehlgeschlagen.`);
  if (fail) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
