/**
 * Smoke: startet pos-api kurz, ruft GET /health, beendet den Prozess.
 * Nutzung: pnpm --filter @gwada/pos-api smoke
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = String(Number(process.env.POS_API_SMOKE_PORT ?? 3099));
const BASE = `http://127.0.0.1:${PORT}`;

async function main() {
  const child = spawn(process.execPath, ["--import", "tsx", "src/main.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (c) => {
    stderr += String(c);
  });

  try {
    let body: { ok?: boolean; service?: string } | null = null;
    for (let i = 0; i < 40; i++) {
      await delay(150);
      try {
        const res = await fetch(`${BASE}/health`);
        if (res.ok) {
          body = (await res.json()) as { ok?: boolean; service?: string };
          break;
        }
      } catch {
        /* still booting */
      }
    }
    if (!body?.ok || body.service !== "pos-api") {
      throw new Error(`health failed: ${JSON.stringify(body)} stderr=${stderr}`);
    }
    console.log("pos-api smoke OK", body);
  } finally {
    child.kill("SIGTERM");
    await delay(200);
    if (!child.killed) child.kill("SIGKILL");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
