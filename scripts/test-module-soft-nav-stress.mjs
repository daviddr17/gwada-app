/**
 * Stress: schnelle Soft-Nav Modulwechsel — Hänger, Errors, Stuck-Pending.
 *
 * Usage: pnpm exec dotenv -e .env.development -- node scripts/test-module-soft-nav-stress.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import nextEnv from "@next/env";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { loadEnvConfig } = nextEnv;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(ROOT);

const BASE = (process.env.GWADA_E2E_BASE || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);
const EMAIL = process.env.GWADA_E2E_EMAIL || "dreyer@techlion.de";

const MODULES = [
  { id: "dashboard", href: "/dashboard", keepAlive: "dashboard" },
  { id: "menu", href: "/dashboard/menu/uebersicht", keepAlive: "menu" },
  { id: "inventory", href: "/dashboard/inventory/uebersicht", keepAlive: "inventory" },
  { id: "reservierungen", href: "/dashboard/reservierungen/uebersicht", keepAlive: "reservierungen" },
  { id: "pos", href: "/dashboard/pos/uebersicht", keepAlive: "pos" },
  { id: "events", href: "/dashboard/events/uebersicht", keepAlive: "events" },
  { id: "kontakte", href: "/dashboard/kontakte/nachrichten?platform=all", keepAlive: "nachrichten" },
  { id: "news", href: "/dashboard/news/uebersicht", keepAlive: "news" },
  { id: "bewertungen", href: "/dashboard/bewertungen/uebersicht", keepAlive: "bewertungen" },
  { id: "insights", href: "/dashboard/insights/uebersicht", keepAlive: "insights" },
  { id: "galerie", href: "/dashboard/galerie/uebersicht", keepAlive: "galerie" },
  { id: "buchfuehrung", href: "/dashboard/buchfuehrung/rechnungen", keepAlive: "buchfuehrung" },
  { id: "dokumente", href: "/dashboard/dokumente/uebersicht", keepAlive: "dokumente" },
  { id: "checklisten", href: "/dashboard/checklisten", keepAlive: "checklisten" },
  { id: "mitarbeiter", href: "/dashboard/mitarbeiter/uebersicht", keepAlive: "mitarbeiter" },
];

const consoleIssues = [];
const pageErrors = [];

function isNoise(text) {
  const t = text.toLowerCase();
  return (
    t.includes("websocket") ||
    t.includes("realtime") ||
    t.includes("channel_error") ||
    t.includes("transport failure") ||
    t.includes("favicon") ||
    t.includes("net::err_") ||
    // Dev-only / known flaky
    t.includes("download the react devtools") ||
    t.includes("fast refresh")
  );
}

async function login(page) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
    options: { redirectTo: `${BASE}/auth/callback` },
  });
  if (error) throw error;
  const cb = new URL(`${BASE}/auth/callback`);
  cb.searchParams.set("token_hash", data.properties.hashed_token);
  cb.searchParams.set("type", "email");
  cb.searchParams.set("next", "/dashboard");
  await page.goto(cb.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 });
}

async function clickModule(page, mod) {
  return page.evaluate((href) => {
    const path = href.split("?")[0];
    const el =
      document.querySelector(`a[href="${href}"]`) ||
      document.querySelector(`a[href^="${path}"]`);
    if (!(el instanceof HTMLAnchorElement)) return { ok: false, reason: "missing" };
    el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    el.click();
    return { ok: true };
  }, mod.href);
}

async function snapshotUi(page) {
  return page.evaluate(() => {
    const path = location.pathname + location.search;
    const busyOverlays = document.querySelectorAll(
      '[aria-busy][aria-live="polite"]',
    ).length;
    const errorText = document.body?.innerText ?? "";
    const crash =
      /couldn't load|konnte nicht geladen|application error|chunkloaderror|this page couldn/i.test(
        errorText,
      );
    const nextOverlay = Boolean(
      document.querySelector("nextjs-portal") ||
        document.querySelector("[data-nextjs-dialog]"),
    );
    const visibleKeepAlives = [
      ...document.querySelectorAll("[data-module-home-keep-alive]"),
    ]
      .filter((el) => !el.classList.contains("hidden"))
      .map((el) => el.getAttribute("data-module-home-keep-alive"));
    const interactiveKeepAlives = [
      ...document.querySelectorAll(
        "[data-module-home-keep-alive]:not(.hidden):not([aria-hidden='true'])",
      ),
    ].map((el) => el.getAttribute("data-module-home-keep-alive"));
    return {
      path,
      busyOverlays,
      crash,
      nextOverlay,
      visibleKeepAlives,
      interactiveKeepAlives,
    };
  });
}

function pathMatchesKeepAlive(path, keepAliveId) {
  if (!keepAliveId) return true;
  const p = path.split("?")[0];
  if (keepAliveId === "dashboard") return p === "/dashboard" || p === "/dashboard/";
  if (keepAliveId === "nachrichten") return p.includes("/kontakte/nachrichten");
  if (keepAliveId === "buchfuehrung") return p.includes("/buchfuehrung");
  if (keepAliveId === "checklisten") return p.includes("/checklisten");
  return p.includes(`/${keepAliveId}`);
}

async function waitSettle(page, timeoutMs = 20_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const snap = await snapshotUi(page);
    const visible = snap.visibleKeepAlives[0] ?? null;
    const urlSynced =
      !visible || pathMatchesKeepAlive(snap.path, visible);
    // nextjs-portal ist DevTools — kein Crash.
    if (!snap.crash && snap.busyOverlays === 0 && urlSynced) {
      return { ok: true, snap, ms: Date.now() - t0, urlSynced: true };
    }
    await page.waitForTimeout(150);
  }
  const snap = await snapshotUi(page);
  const visible = snap.visibleKeepAlives[0] ?? null;
  return {
    ok: false,
    snap,
    ms: timeoutMs,
    urlSynced: !visible || pathMatchesKeepAlive(snap.path, visible),
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60_000);

page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  if (isNoise(text)) return;
  consoleIssues.push(text.slice(0, 240));
});
page.on("pageerror", (err) => {
  const text = String(err?.message ?? err);
  if (isNoise(text)) return;
  pageErrors.push(text.slice(0, 240));
});

const report = {
  bursts: [],
  settleChecks: [],
  pingPong: null,
  finalProbe: [],
  consoleIssues: [],
  pageErrors: [],
  verdict: "unknown",
};

console.log(`Base ${BASE}`);
await login(page);
await page
  .waitForFunction(
    () => (document.body?.innerText ?? "").includes("Heute"),
    { timeout: 25_000 },
  )
  .catch(() => {});
await page.waitForTimeout(2500);

// --- Burst 1: round-robin ~50ms ---
{
  const delays = [40, 50, 60, 45, 55];
  const sequence = [];
  for (let round = 0; round < 3; round++) {
    for (const mod of MODULES) sequence.push(mod);
  }
  console.log(`Burst round-robin: ${sequence.length} clicks`);
  const t0 = Date.now();
  let clickFails = 0;
  for (let i = 0; i < sequence.length; i++) {
    const mod = sequence[i];
    const res = await clickModule(page, mod);
    if (!res.ok) clickFails += 1;
    await page.waitForTimeout(delays[i % delays.length]);
  }
  const afterBurst = await waitSettle(page, 15_000);
  const snap = afterBurst.snap;
  report.bursts.push({
    name: "round-robin-50ms",
    clicks: sequence.length,
    clickFails,
    elapsedMs: Date.now() - t0,
    settleOk: afterBurst.ok,
    settleMs: afterBurst.ms,
    urlSynced: afterBurst.urlSynced,
    crash: snap.crash,
    busyOverlays: snap.busyOverlays,
    path: snap.path,
    visibleKeepAlives: snap.visibleKeepAlives,
  });
  console.log(
    `round-robin done settle=${afterBurst.ok} urlSynced=${afterBurst.urlSynced} path=${snap.path} visible=${snap.visibleKeepAlives} busy=${snap.busyOverlays}`,
  );
}

// --- Burst 2: zig-zag distant modules ~30ms ---
{
  const pairs = [
    MODULES.find((m) => m.id === "dashboard"),
    MODULES.find((m) => m.id === "mitarbeiter"),
    MODULES.find((m) => m.id === "menu"),
    MODULES.find((m) => m.id === "buchfuehrung"),
    MODULES.find((m) => m.id === "reservierungen"),
    MODULES.find((m) => m.id === "news"),
    MODULES.find((m) => m.id === "kontakte"),
    MODULES.find((m) => m.id === "dokumente"),
  ];
  const sequence = [];
  for (let i = 0; i < 40; i++) sequence.push(pairs[i % pairs.length]);
  console.log(`Burst zig-zag: ${sequence.length} clicks @30ms`);
  const t0 = Date.now();
  for (const mod of sequence) {
    await clickModule(page, mod);
    await page.waitForTimeout(30);
  }
  const afterBurst = await waitSettle(page, 15_000);
  report.bursts.push({
    name: "zigzag-30ms",
    clicks: sequence.length,
    elapsedMs: Date.now() - t0,
    settleOk: afterBurst.ok,
    settleMs: afterBurst.ms,
    urlSynced: afterBurst.urlSynced,
    crash: afterBurst.snap.crash,
    busyOverlays: afterBurst.snap.busyOverlays,
    path: afterBurst.snap.path,
    visibleKeepAlives: afterBurst.snap.visibleKeepAlives,
  });
  console.log(
    `zigzag done settle=${afterBurst.ok} urlSynced=${afterBurst.urlSynced} path=${afterBurst.snap.path} visible=${afterBurst.snap.visibleKeepAlives}`,
  );
}

// --- Ping-pong dashboard ↔ menu 25x ---
{
  const a = MODULES.find((m) => m.id === "dashboard");
  const b = MODULES.find((m) => m.id === "menu");
  console.log("Ping-pong dashboard↔menu x25 @35ms");
  const t0 = Date.now();
  for (let i = 0; i < 25; i++) {
    await clickModule(page, i % 2 === 0 ? b : a);
    await page.waitForTimeout(35);
  }
  const after = await waitSettle(page, 12_000);
  report.pingPong = {
    clicks: 25,
    elapsedMs: Date.now() - t0,
    settleOk: after.ok,
    settleMs: after.ms,
    crash: after.snap.crash,
    busyOverlays: after.snap.busyOverlays,
    path: after.snap.path,
  };
  console.log(`pingpong settle=${after.ok} path=${after.snap.path}`);
}

// --- Final probe: each module once, expect preview + no crash ---
console.log("Final probe: each module slowly");
for (const mod of MODULES) {
  const t0 = Date.now();
  await clickModule(page, mod);
  const previewOk = await page
    .waitForFunction(
      (keepAlive) =>
        Boolean(
          document.querySelector(
            `[data-module-home-keep-alive="${keepAlive}"]:not(.hidden)`,
          ),
        ),
      mod.keepAlive,
      { timeout: 8_000 },
    )
    .then(() => true)
    .catch(() => false);
  const settled = await waitSettle(page, 18_000);
  const snap = settled.snap;
  const pathOk = pathMatchesKeepAlive(snap.path, mod.keepAlive);
  report.finalProbe.push({
    id: mod.id,
    previewOk,
    pathOk,
    urlSynced: settled.urlSynced,
    crash: snap.crash,
    busyOverlays: snap.busyOverlays,
    previewMs: Date.now() - t0,
    settleMs: settled.ms,
    path: snap.path,
    visible: snap.visibleKeepAlives,
  });
  console.log(
    `probe ${mod.id}: preview=${previewOk} pathOk=${pathOk} urlSynced=${settled.urlSynced} ${Date.now() - t0}ms → ${snap.path}`,
  );
}

report.consoleIssues = [...new Set(consoleIssues)].slice(0, 20);
report.pageErrors = [...new Set(pageErrors)].slice(0, 20);

const burstOk = report.bursts.every(
  (b) => b.settleOk && !b.crash && b.busyOverlays === 0,
);
const pingOk =
  report.pingPong?.settleOk &&
  !report.pingPong?.crash &&
  report.pingPong?.busyOverlays === 0;
const probeOk = report.finalProbe.every(
  (p) =>
    p.previewOk &&
    p.pathOk &&
    p.urlSynced &&
    !p.crash &&
    p.busyOverlays === 0,
);
const noHardErrors = report.pageErrors.length === 0;

report.verdict =
  burstOk && pingOk && probeOk && noHardErrors ? "PASS" : "FAIL";
report.checks = { burstOk, pingOk, probeOk, noHardErrors };

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.verdict === "PASS" ? 0 : 1);
