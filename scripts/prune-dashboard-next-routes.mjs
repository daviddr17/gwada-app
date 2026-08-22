#!/usr/bin/env node
/**
 * Removes legacy Next dashboard routes after Vite SPA migration.
 * Keeps: layout.tsx, [[...slug]]/page.tsx, error.tsx
 */
import fs from "node:fs";
import path from "node:path";

const dashboardRoot = path.resolve(
  import.meta.dirname,
  "../apps/web/app/(platform)/(app)/dashboard",
);

const KEEP = new Set([
  path.join(dashboardRoot, "layout.tsx"),
  path.join(dashboardRoot, "error.tsx"),
  path.join(dashboardRoot, "[[...slug]]", "page.tsx"),
]);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "[[...slug]]") continue;
      walk(full);
      try {
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } catch {
        /* ignore */
      }
      continue;
    }
    if (KEEP.has(full)) continue;
    if (
      entry.name === "page.tsx" ||
      entry.name === "loading.tsx" ||
      entry.name === "layout.tsx"
    ) {
      fs.unlinkSync(full);
      console.log("removed", full);
    }
  }
}

walk(dashboardRoot);
console.log("Done pruning legacy dashboard Next routes.");
