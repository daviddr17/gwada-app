#!/usr/bin/env node
/**
 * EAS iOS: limit pnpm workspace to staff + packages so prebuild's follow-up
 * `pnpm install` does not pull apps/web (sharp native build fails on workers).
 */
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const staffDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(staffDir, "../..");
const webDir = join(repoRoot, "apps/web");

writeFileSync(
  join(repoRoot, "pnpm-workspace.yaml"),
  `packages:
  - "apps/staff"
  - "packages/*"
`,
  "utf8",
);

if (existsSync(webDir)) {
  rmSync(webDir, { recursive: true, force: true });
  console.log("Removed apps/web from EAS build tree");
}

console.log("Patched pnpm-workspace.yaml for staff-only EAS install");
