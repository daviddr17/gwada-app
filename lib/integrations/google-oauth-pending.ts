import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

export const GOOGLE_OAUTH_PENDING_COOKIE = "gwada_google_oauth_pending";
const PENDING_TTL_SEC = 15 * 60;

export type GoogleBusinessLocationOption = {
  accountName: string;
  accountTitle: string;
  locationName: string;
  locationTitle: string;
};

export type GoogleOAuthPendingPayload = {
  restaurantId: string;
  accessToken: string;
  refreshToken: string | null;
  grantedScopes: string[];
  locations: GoogleBusinessLocationOption[];
  exp: number;
};

function pendingSecret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function encodeGoogleOAuthPending(
  payload: Omit<GoogleOAuthPendingPayload, "exp">,
): string | null {
  const secret = pendingSecret();
  if (!secret) return null;
  const full: GoogleOAuthPendingPayload = {
    ...payload,
    exp: Date.now() + PENDING_TTL_SEC * 1000,
  };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  return `${body}.${signBody(body, secret)}`;
}

export function decodeGoogleOAuthPending(
  token: string | undefined | null,
): GoogleOAuthPendingPayload | null {
  const secret = pendingSecret();
  if (!secret || !token?.trim()) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = signBody(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as GoogleOAuthPendingPayload;
    if (
      !parsed ||
      typeof parsed.exp !== "number" ||
      Date.now() > parsed.exp ||
      typeof parsed.restaurantId !== "string" ||
      typeof parsed.accessToken !== "string" ||
      !Array.isArray(parsed.locations) ||
      !Array.isArray(parsed.grantedScopes)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function googleOAuthPendingCookieHeader(token: string): string {
  const parts = [
    `${GOOGLE_OAUTH_PENDING_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${PENDING_TTL_SEC}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearGoogleOAuthPendingCookieHeader(): string {
  const parts = [
    `${GOOGLE_OAUTH_PENDING_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function readGoogleOAuthPendingFromRequest(
  req: Request,
): GoogleOAuthPendingPayload | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${GOOGLE_OAUTH_PENDING_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeGoogleOAuthPending(decodeURIComponent(match[1]));
  } catch {
    return decodeGoogleOAuthPending(match[1]);
  }
}
