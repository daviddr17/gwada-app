import "server-only";

import { checkInMemoryRateLimit } from "@/lib/api/in-memory-rate-limit";
import { getRequestClientIp } from "@/lib/api/request-client-ip";

const WINDOW_MS = 60_000;

export const PUBLIC_API_READ_LIMIT_PER_IP = 30;
export const PUBLIC_API_READ_LIMIT_PER_IP_SCOPE = 20;
export const PUBLIC_API_WRITE_LIMIT_PER_IP = 10;
export const PUBLIC_API_WRITE_LIMIT_PER_IP_SCOPE = 5;

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

function checkScopedRateLimit(
  request: Request,
  scope: string | undefined,
  ipLimit: number,
  scopeLimit: number,
): Response | null {
  const ip = getRequestClientIp(request);

  const ipCheck = checkInMemoryRateLimit(
    `public-api:ip:${ip}`,
    ipLimit,
    WINDOW_MS,
  );
  if (!ipCheck.allowed) {
    return rateLimitResponse(ipCheck.retryAfterSec, ipLimit);
  }

  if (!scope) return null;

  const scopeCheck = checkInMemoryRateLimit(
    `public-api:ip-scope:${ip}:${scope}`,
    scopeLimit,
    WINDOW_MS,
  );
  if (!scopeCheck.allowed) {
    return rateLimitResponse(scopeCheck.retryAfterSec, scopeLimit);
  }

  return null;
}

/** GET-Endpunkte unter /api/public/… (Slug-Embeds, Profil-Module). */
export function enforcePublicApiReadRateLimit(
  request: Request,
  scope?: string,
): Response | null {
  return checkScopedRateLimit(
    request,
    scope,
    PUBLIC_API_READ_LIMIT_PER_IP,
    PUBLIC_API_READ_LIMIT_PER_IP_SCOPE,
  );
}

/** POST-Endpunkte (Reservierung, Kontakt, …). */
export function enforcePublicApiWriteRateLimit(
  request: Request,
  scope?: string,
): Response | null {
  return checkScopedRateLimit(
    request,
    scope,
    PUBLIC_API_WRITE_LIMIT_PER_IP,
    PUBLIC_API_WRITE_LIMIT_PER_IP_SCOPE,
  );
}
