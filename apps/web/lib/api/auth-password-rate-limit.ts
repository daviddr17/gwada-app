import { checkInMemoryRateLimit } from "@/lib/api/in-memory-rate-limit";
import { getRequestClientIp } from "@/lib/api/request-client-ip";

const WINDOW_MS = 15 * 60 * 1000;

/** Passwort-Grants pro IP und 15 Minuten (geteilte Netze). */
export const AUTH_PASSWORD_IP_LIMIT = 80;

/** Passwort-Grants pro E-Mail und 15 Minuten. */
export const AUTH_PASSWORD_EMAIL_LIMIT = 20;

function rateLimitResponse(retryAfterSec: number): Response {
  return Response.json(
    {
      error: "too_many_password_attempts",
      error_description: "too_many_password_attempts",
      msg: "too_many_password_attempts",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    },
  );
}

function emailFromPasswordGrantBody(body: ArrayBuffer): string | null {
  try {
    const json = JSON.parse(new TextDecoder().decode(body)) as {
      email?: unknown;
    };
    if (typeof json.email !== "string") return null;
    const email = json.email.trim().toLowerCase();
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

/**
 * Bremst Passwort-Login über den `/sb`-Proxy (GoTrue `grant_type=password`).
 * Zählt vor dem Upstream, damit Fehlversuche nicht unbegrenzt durchkommen.
 */
export function enforcePasswordGrantRateLimit(
  request: Request,
  body: ArrayBuffer,
): Response | null {
  const ip = getRequestClientIp(request);
  if (ip !== "unknown") {
    const ipCheck = checkInMemoryRateLimit(
      `auth-password:ip:${ip}`,
      AUTH_PASSWORD_IP_LIMIT,
      WINDOW_MS,
    );
    if (!ipCheck.allowed) return rateLimitResponse(ipCheck.retryAfterSec);
  }

  const email = emailFromPasswordGrantBody(body);
  if (!email) return null;

  const emailCheck = checkInMemoryRateLimit(
    `auth-password:email:${email}`,
    AUTH_PASSWORD_EMAIL_LIMIT,
    WINDOW_MS,
  );
  if (!emailCheck.allowed) {
    return rateLimitResponse(emailCheck.retryAfterSec);
  }
  return null;
}
