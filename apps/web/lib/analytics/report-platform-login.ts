"use client";

const LOGIN_REPORT_MS = 800;

/** Anmeldung melden, ohne die Weiterleitung zu blockieren. */
export async function reportPlatformLogin(
  method: "password" | "passkey",
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_REPORT_MS);
  try {
    await fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ kind: "login", loginMethod: method }),
      signal: controller.signal,
    });
  } catch {
    /* Statistik darf die Anmeldung nicht aufhalten. */
  } finally {
    clearTimeout(timer);
  }
}
