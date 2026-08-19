#!/usr/bin/env node
/**
 * Statischer Guard: Keep-alive Screens dürfen in useEffect keinen
 * router.replace/push ohne `active`-Gate haben.
 *
 * Exit 1 bei Verstoß — Regression gegen Soft-Nav-Hijack (Nachrichten).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  {
    file: "apps/web/components/contacts/contacts-messages-screen.tsx",
    homeId: "nachrichten",
  },
  {
    file: "apps/web/components/reservations/reservations-overview.tsx",
    homeId: "reservierungen",
  },
];

function extractUseEffects(source) {
  const effects = [];
  const re = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const start = match.index;
    let i = match.index + match[0].length;
    let depth = 1;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      i += 1;
    }
    const body = source.slice(start, i);
    const line = source.slice(0, start).split("\n").length;
    effects.push({ line, body });
  }
  return effects;
}

function effectHasRouterNav(body) {
  return /router\.(replace|push)\s*\(/.test(body);
}

function effectGatesActive(body) {
  return (
    /if\s*\(\s*!active\s*\)/.test(body) ||
    /if\s*\(\s*!keepAliveMayNavigate\s*\(\s*active\s*\)\s*\)/.test(body) ||
    /if\s*\(\s*!keepAliveOwnsPathname\s*\(/.test(body) ||
    /keepAliveOwnsPathname\s*\(\s*active/.test(body)
  );
}

let failed = false;

for (const target of TARGETS) {
  const abs = path.join(root, target.file);
  const source = fs.readFileSync(abs, "utf8");
  const effects = extractUseEffects(source);
  for (const effect of effects) {
    if (!effectHasRouterNav(effect.body)) continue;
    if (effectGatesActive(effect.body)) continue;
    failed = true;
    console.error(
      `FAIL ${target.file}:${effect.line} — useEffect mit router.replace/push ohne active-Gate (${target.homeId})`,
    );
  }

  // Hardcoded Inbox-Path in Effects ohne Gate (Nachrichten-Klassiker)
  if (target.homeId === "nachrichten") {
    const effectsWithHardPath = effects.filter(
      (e) =>
        e.body.includes("/dashboard/kontakte/nachrichten") &&
        effectHasRouterNav(e.body),
    );
    for (const effect of effectsWithHardPath) {
      if (effectGatesActive(effect.body)) continue;
      failed = true;
      console.error(
        `FAIL ${target.file}:${effect.line} — Effect navigiert hart nach Nachrichten ohne active-Gate`,
      );
    }
  }
}

// Slot muss inactive inert machen
const slotPath = path.join(
  root,
  "apps/web/components/navigation/module-home-keep-alive-slot.tsx",
);
const slotSrc = fs.readFileSync(slotPath, "utf8");
if (!/!interactive/.test(slotSrc) || !/inert/.test(slotSrc)) {
  failed = true;
  console.error(
    "FAIL module-home-keep-alive-slot.tsx — inactive slots must be inert / non-interactive",
  );
}

// Sidebar-hrefs müssen zu den simulierten Zielen passen (Drift-Schutz).
const sidebarSrc = fs.readFileSync(
  path.join(root, "apps/web/lib/constants/sidebar-modules.ts"),
  "utf8",
);
const hrefMatches = [...sidebarSrc.matchAll(/href:\s*"([^"]+)"/g)].map(
  (m) => m[1],
);
const expected = [
  "/dashboard/menu/uebersicht",
  "/dashboard/inventory/uebersicht",
  "/dashboard/reservierungen/uebersicht",
  "/dashboard/pos/uebersicht",
  "/dashboard/events/uebersicht",
  "/dashboard/kontakte/nachrichten?platform=all",
  "/dashboard/news/uebersicht",
  "/dashboard/bewertungen/uebersicht",
  "/dashboard/insights/uebersicht",
  "/dashboard/galerie/uebersicht",
  "/dashboard/buchfuehrung/rechnungen",
  "/dashboard/dokumente/uebersicht",
  "/dashboard/checklisten",
  "/dashboard/mitarbeiter/uebersicht",
];
if (hrefMatches.length !== expected.length) {
  failed = true;
  console.error(
    `FAIL sidebar href count ${hrefMatches.length} !== ${expected.length}`,
  );
}
for (let i = 0; i < expected.length; i += 1) {
  if (hrefMatches[i] !== expected[i]) {
    failed = true;
    console.error(
      `FAIL sidebar href[${i}]: got ${hrefMatches[i]} want ${expected[i]}`,
    );
  }
}

if (failed) {
  process.exit(1);
}
console.log("OK module-home keep-alive nav audit");
