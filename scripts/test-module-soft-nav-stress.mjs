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
    const nodes = [
      ...document.querySelectorAll(`a[href="${href}"]`),
      ...document.querySelectorAll(`a[href^="${path}"]`),
    ];
    const el = nodes.find((node) => {
      if (!(node instanceof HTMLAnchorElement)) return false;
      if (node.closest("[data-module-home-keep-alive][aria-hidden='true']")) {
        return false;
      }
      // Nicht class "hidden" — Tailwind `hidden md:flex` bleibt im DOM.
      const r = node.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    });
    if (!el) return { ok: false, reason: "missing" };
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
    const chromeTitle =
      document.querySelector("[data-app-chrome-header] h1")?.textContent?.trim() ??
      "";
    const dashboardHeute = /Heute/i.test(errorText) &&
      /Reservierungen/i.test(errorText) &&
      /Wetter/i.test(errorText);
    const keepAliveTitles = {
      dashboard: "Dashboard",
      menu: "Speisekarte",
      inventory: "Bestand",
      reservierungen: "Reservierungen",
      pos: "POS",
      events: "Events",
      nachrichten: "Nachrichten",
      news: "News",
      bewertungen: "Bewertungen",
      insights: "Insights",
      galerie: "Galerie",
      buchfuehrung: "Buchführung",
      dokumente: "Dokumente",
      checklisten: "Checklisten",
      mitarbeiter: "Mitarbeiter",
    };
    const visibleHome = visibleKeepAlives[0];
    const expectedTitle = visibleHome ? keepAliveTitles[visibleHome] : null;
    const titleContentMismatch =
      chromeTitle.length > 0 &&
      ((expectedTitle != null && chromeTitle !== expectedTitle) ||
        (chromeTitle !== "Dashboard" &&
          visibleKeepAlives.includes("dashboard") &&
          dashboardHeute));
    return {
      path,
      chromeTitle,
      busyOverlays,
      crash,
      nextOverlay,
      visibleKeepAlives,
      interactiveKeepAlives,
      titleContentMismatch,
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

async function clickVisibleHref(page, href) {
  const loc = page.locator(`a[href="${href}"]`);
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const item = loc.nth(i);
    if (await item.isVisible()) {
      await item.click({ timeout: 8_000 });
      return { ok: true };
    }
  }
  return clickModule(page, { href });
}

function lastLandedOk(snap, lastMod) {
  if (!lastMod) return false;
  return (
    pathMatchesKeepAlive(snap.path, lastMod.keepAlive) &&
    !snap.titleContentMismatch &&
    !snap.crash &&
    snap.busyOverlays === 0
  );
}

async function waitSettle(page, timeoutMs = 20_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const snap = await snapshotUi(page);
    const visible = snap.visibleKeepAlives[0] ?? null;
    const urlSynced =
      !visible || pathMatchesKeepAlive(snap.path, visible);
    // nextjs-portal ist DevTools — kein Crash.
    if (
      !snap.crash &&
      snap.busyOverlays === 0 &&
      urlSynced &&
      !snap.titleContentMismatch
    ) {
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
  warmup: [],
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
    null,
    { timeout: 25_000 },
  )
  .catch(() => {});
await page.waitForTimeout(2500);

console.log("Warmup: compile each module once");
report.warmup = [];
for (const mod of MODULES) {
  const t0 = Date.now();
  const clicked = await clickModule(page, mod);
  if (!clicked.ok) {
    report.warmup.push({
      id: mod.id,
      ok: false,
      reason: clicked.reason,
      ms: Date.now() - t0,
      path: await page.evaluate(() => location.pathname),
    });
    console.error(`warmup ${mod.id}: click missing`);
    report.verdict = "FAIL";
    report.checks = { warmupOk: false };
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    process.exit(1);
  }
  const landed = await page
    .waitForFunction(
      ({ keepAlive, href }) => {
        const p = location.pathname;
        if (keepAlive === "dashboard") return p === "/dashboard";
        if (keepAlive === "nachrichten") return p.includes("/kontakte/nachrichten");
        const path = href.split("?")[0];
        return p === path || p.startsWith(`${path}/`) || p.includes(`/${keepAlive}`);
      },
      { keepAlive: mod.keepAlive, href: mod.href },
      { timeout: 45_000 },
    )
    .then(() => true)
    .catch(() => false);
  report.warmup.push({
    id: mod.id,
    ok: landed,
    ms: Date.now() - t0,
    path: await page.evaluate(() => location.pathname),
  });
  console.log(
    `warmup ${mod.id}: ok=${landed} ${Date.now() - t0}ms → ${await page.evaluate(() => location.pathname)}`,
  );
  if (!landed) {
    console.error("warmup failed — abort stress");
    report.verdict = "FAIL";
    report.checks = { warmupOk: false };
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    process.exit(1);
  }
}

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
  const last = sequence[sequence.length - 1];
  const lastOk = lastLandedOk(snap, last);
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
    chromeTitle: snap.chromeTitle,
    visibleKeepAlives: snap.visibleKeepAlives,
    titleContentMismatch: snap.titleContentMismatch,
    expectedLast: last.id,
    lastOk,
  });
  console.log(
    `round-robin done settle=${afterBurst.ok} lastOk=${lastOk} expected=${last.id} path=${snap.path} title=${snap.chromeTitle} visible=${snap.visibleKeepAlives} busy=${snap.busyOverlays}`,
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
  const last = sequence[sequence.length - 1];
  const lastOk = lastLandedOk(afterBurst.snap, last);
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
    chromeTitle: afterBurst.snap.chromeTitle,
    visibleKeepAlives: afterBurst.snap.visibleKeepAlives,
    titleContentMismatch: afterBurst.snap.titleContentMismatch,
    expectedLast: last.id,
    lastOk,
  });
  console.log(
    `zigzag done settle=${afterBurst.ok} lastOk=${lastOk} expected=${last.id} path=${afterBurst.snap.path} title=${afterBurst.snap.chromeTitle} visible=${afterBurst.snap.visibleKeepAlives}`,
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
  const lastMod = b; // i=24 even → menu
  report.pingPong = {
    clicks: 25,
    elapsedMs: Date.now() - t0,
    settleOk: after.ok,
    settleMs: after.ms,
    crash: after.snap.crash,
    busyOverlays: after.snap.busyOverlays,
    path: after.snap.path,
    chromeTitle: after.snap.chromeTitle,
    titleContentMismatch: after.snap.titleContentMismatch,
    expectedLast: lastMod.id,
    lastOk: lastLandedOk(after.snap, lastMod),
  };
  console.log(
    `pingpong settle=${after.ok} lastOk=${report.pingPong.lastOk} path=${after.snap.path} title=${after.snap.chromeTitle}`,
  );
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
    chromeTitle: snap.chromeTitle,
    visible: snap.visibleKeepAlives,
    titleContentMismatch: snap.titleContentMismatch,
  });
  console.log(
    `probe ${mod.id}: preview=${previewOk} pathOk=${pathOk} urlSynced=${settled.urlSynced} mismatch=${snap.titleContentMismatch} ${Date.now() - t0}ms → ${snap.path} title=${snap.chromeTitle}`,
  );
}

console.log("Race: Events home then Einstellungen immediately");
{
  const t0 = Date.now();
  await clickModule(page, MODULES.find((m) => m.id === "events"));
  let clicked = { ok: false };
  for (let i = 0; i < 24 && !clicked.ok; i++) {
    clicked = await clickVisibleHref(page, "/dashboard/events/einstellungen");
    if (!clicked.ok) await page.waitForTimeout(50);
  }
  const landed = await page
    .waitForFunction(
      () => location.pathname.startsWith("/dashboard/events/einstellungen"),
      null,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(900);
  const snap = await snapshotUi(page);
  const body = await page.evaluate(() => document.body?.innerText ?? "");
  const ok =
    clicked.ok &&
    landed &&
    !snap.crash &&
    snap.busyOverlays === 0 &&
    !snap.titleContentMismatch &&
    snap.chromeTitle === "Events" &&
    body.includes("Menüvorschläge");
  report.eventsSettingsRace = {
    ok,
    clicked: clicked.ok,
    landed,
    crash: snap.crash,
    busyOverlays: snap.busyOverlays,
    titleContentMismatch: snap.titleContentMismatch,
    path: snap.path,
    chromeTitle: snap.chromeTitle,
    visible: snap.visibleKeepAlives,
    hasMenus: body.includes("Menüvorschläge"),
    ms: Date.now() - t0,
  };
  console.log(
    `events→settings race ok=${ok} landed=${landed} title=${snap.chromeTitle} path=${snap.path} mismatch=${snap.titleContentMismatch}`,
  );
}

const SETTINGS_PROBES = [
  {
    id: "events-settings",
    home: "/dashboard/events/uebersicht",
    href: "/dashboard/events/einstellungen",
    expectTitle: "Events",
    expectText: "Menüvorschläge",
  },
  {
    id: "news-settings",
    home: "/dashboard/news/uebersicht",
    href: "/dashboard/news/einstellungen",
    expectTitle: "News",
  },
  {
    id: "reservierungen-settings",
    home: "/dashboard/reservierungen/uebersicht",
    href: "/dashboard/reservierungen/einstellungen",
    expectTitle: "Reservierungen",
  },
  {
    id: "menu-settings",
    home: "/dashboard/menu/uebersicht",
    href: "/dashboard/menu/einstellungen",
    expectTitle: "Speisekarte",
  },
  {
    id: "mitarbeiter-settings",
    home: "/dashboard/mitarbeiter/uebersicht",
    href: "/dashboard/mitarbeiter/einstellungen",
    expectTitle: "Mitarbeiter",
  },
];

console.log("Settings/subnav probes");
report.settingsProbes = [];
for (const probe of SETTINGS_PROBES) {
  const t0 = Date.now();
  await clickModule(page, { href: probe.home });
  await waitSettle(page, 12_000);
  const clicked = await clickVisibleHref(page, probe.href);
  const landed = await page
    .waitForFunction(
      (expectPath) => location.pathname.startsWith(expectPath),
      probe.href,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(900);
  const snap = await snapshotUi(page);
  const body = await page.evaluate(() => document.body?.innerText ?? "");
  const expectTextOk = !probe.expectText || body.includes(probe.expectText);
  const dashboardLeak =
    snap.visibleKeepAlives.includes("dashboard") && snap.titleContentMismatch;
  const ok =
    clicked.ok &&
    landed &&
    !snap.crash &&
    snap.busyOverlays === 0 &&
    !dashboardLeak &&
    expectTextOk &&
    (probe.expectTitle ? snap.chromeTitle === probe.expectTitle : true);
  report.settingsProbes.push({
    id: probe.id,
    ok,
    clicked: clicked.ok,
    landed,
    expectTextOk,
    dashboardLeak,
    crash: snap.crash,
    busyOverlays: snap.busyOverlays,
    path: snap.path,
    chromeTitle: snap.chromeTitle,
    visible: snap.visibleKeepAlives,
    ms: Date.now() - t0,
  });
  console.log(
    `settings ${probe.id}: ok=${ok} landed=${landed} title=${snap.chromeTitle} path=${snap.path} leak=${dashboardLeak}`,
  );
}

report.consoleIssues = [...new Set(consoleIssues)].slice(0, 20);
report.pageErrors = [...new Set(pageErrors)].slice(0, 20);

const warmupOk = (report.warmup ?? []).every((w) => w.ok);
const burstOk = report.bursts.every(
  (b) =>
    b.settleOk &&
    !b.crash &&
    b.busyOverlays === 0 &&
    !b.titleContentMismatch &&
    b.lastOk,
);
const pingOk =
  report.pingPong?.settleOk &&
  !report.pingPong?.crash &&
  report.pingPong?.busyOverlays === 0 &&
  !report.pingPong?.titleContentMismatch &&
  report.pingPong?.lastOk;
const probeOk = report.finalProbe.every(
  (p) =>
    p.previewOk &&
    p.pathOk &&
    p.urlSynced &&
    !p.crash &&
    p.busyOverlays === 0 &&
    !p.titleContentMismatch &&
    p.settleMs < 4_000,
);
const settingsOk =
  (report.settingsProbes ?? []).every((p) => p.ok) &&
  report.eventsSettingsRace?.ok !== false;
const noHardErrors = report.pageErrors.length === 0;

report.verdict =
  warmupOk && burstOk && pingOk && probeOk && settingsOk && noHardErrors
    ? "PASS"
    : "FAIL";
report.checks = {
  warmupOk,
  burstOk,
  pingOk,
  probeOk,
  settingsOk,
  raceOk: report.eventsSettingsRace?.ok,
  noHardErrors,
};

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.verdict === "PASS" ? 0 : 1);
