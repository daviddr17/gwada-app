import "server-only";

import { checkInMemoryRateLimit } from "@/lib/api/in-memory-rate-limit";
import { getRequestClientIp } from "@/lib/api/request-client-ip";

const WINDOW_MS = 60 * 60 * 1000;

/** Max. Auth-Mail-Anfragen pro IP und Stunde (Magic Link, Passwort-Reset). */
export const AUTH_EMAIL_IP_LIMIT_PER_HOUR = 20;

/** Max. Auth-Mail-Anfragen pro E-Mail-Adresse und Stunde. */
export const AUTH_EMAIL_ADDRESS_LIMIT_PER_HOUR = 3;

function rateLimitResponse(retryAfterSec: number, limit: number): Response {
  return Response.json(
    { error: "rate_limit_exceeded" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(limit),
        "Cache-Control": "no-store",
      },
    },
  );
}

function normalizeEmailForLimit(email: string): string {
  return email.trim().toLowerCase();
}

/** Rate-Limit für `/api/auth/magic-link` und `/api/auth/forgot-password`. */
export function enforceAuthEmailRateLimit(
  request: Request,
  email: string,
): Response | null {
  const ip = getRequestClientIp(request);
  const normalizedEmail = normalizeEmailForLimit(email);

  const ipCheck = checkInMemoryRateLimit(
    `auth-email:ip:${ip}`,
    AUTH_EMAIL_IP_LIMIT_PER_HOUR,
    WINDOW_MS,
  );
  if (!ipCheck.allowed) {
    return rateLimitResponse(ipCheck.retryAfterSec, AUTH_EMAIL_IP_LIMIT_PER_HOUR);
  }

  const emailCheck = checkInMemoryRateLimit(
    `auth-email:address:${normalizedEmail}`,
    AUTH_EMAIL_ADDRESS_LIMIT_PER_HOUR,
    WINDOW_MS,
  );
  if (!emailCheck.allowed) {
    return rateLimitResponse(
      emailCheck.retryAfterSec,
      AUTH_EMAIL_ADDRESS_LIMIT_PER_HOUR,
    );
  }

  return null;
}
