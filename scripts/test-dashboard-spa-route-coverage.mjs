#!/usr/bin/env node
/**
 * Smoke: TanStack dashboard route table covers all legacy Next dashboard paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scan = JSON.parse(
  fs.readFileSync(path.join(ROOT, "dashboard-routes-scan.json"), "utf8"),
);
const generated = fs.readFileSync(
  path.join(ROOT, "apps/dashboard/src/generated/route-modules.ts"),
  "utf8",
);

function toTanstackPath(fullPath) {
  if (fullPath === "/dashboard") return "/";
  return fullPath.replace(/^\/dashboard/, "") || "/";
}

const lazyPaths = new Set();
const redirectPaths = new Set();
for (const line of generated.split("\n")) {
  const lazy = line.match(/path: "([^"]+)", fullPath: "([^"]+)", Lazy:/);
  if (lazy) lazyPaths.add(toTanstackPath(lazy[2]));
  const redir = line.match(/path: "([^"]+)", fullPath: "([^"]+)", redirect:/);
  if (redir) redirectPaths.add(redir[1] === "/" ? "/" : redir[1].replace(/^\//, ""));
}

const missing = [];
for (const entry of scan) {
  const tanstackPath = toTanstackPath(entry.route);
  if (entry.pageBehavior === "redirect") {
    const key = tanstackPath === "/" ? "/" : tanstackPath.replace(/^\//, "");
    if (!redirectPaths.has(key) && !redirectPaths.has(tanstackPath)) {
      missing.push(entry.route);
    }
    continue;
  }
  if (!lazyPaths.has(tanstackPath)) {
    missing.push(entry.route);
  }
}

if (missing.length > 0) {
  console.error("Missing SPA routes:", missing);
  process.exit(1);
}

console.log(
  `OK dashboard SPA route coverage: ${lazyPaths.size} lazy + ${redirectPaths.size} redirects, ${scan.length} legacy paths`,
);
