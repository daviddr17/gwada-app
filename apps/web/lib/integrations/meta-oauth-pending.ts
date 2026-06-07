import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import type { MetaPageAccount } from "@/lib/integrations/meta-oauth-shared";

export const META_OAUTH_PENDING_COOKIE = "gwada_meta_oauth_pending";
const PENDING_TTL_SEC = 15 * 60;

export type MetaOAuthPendingProvider = "facebook" | "instagram";

export type MetaOAuthPendingPayload = {
  provider: MetaOAuthPendingProvider;
  restaurantId: string;
  userAccessToken: string;
  grantedScopes: string[];
  pages: MetaPageAccount[];
  exp: number;
};

function pendingSecret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function encodeMetaOAuthPending(
  payload: Omit<MetaOAuthPendingPayload, "exp">,
): string | null {
  const secret = pendingSecret();
  if (!secret) return null;
  const full: MetaOAuthPendingPayload = {
    ...payload,
    exp: Date.now() + PENDING_TTL_SEC * 1000,
  };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  return `${body}.${signBody(body, secret)}`;
}

export function decodeMetaOAuthPending(
  token: string | undefined | null,
): MetaOAuthPendingPayload | null {
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
    ) as MetaOAuthPendingPayload;
    if (
      !parsed ||
      typeof parsed.exp !== "number" ||
      Date.now() > parsed.exp ||
      (parsed.provider !== "facebook" && parsed.provider !== "instagram") ||
      typeof parsed.restaurantId !== "string" ||
      typeof parsed.userAccessToken !== "string" ||
      !Array.isArray(parsed.pages) ||
      !Array.isArray(parsed.grantedScopes)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function metaOAuthPendingCookieHeader(token: string): string {
  const parts = [
    `${META_OAUTH_PENDING_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${PENDING_TTL_SEC}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearMetaOAuthPendingCookieHeader(): string {
  const parts = [
    `${META_OAUTH_PENDING_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function readMetaOAuthPendingFromRequest(req: Request): MetaOAuthPendingPayload | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${META_OAUTH_PENDING_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeMetaOAuthPending(decodeURIComponent(match[1]));
  } catch {
    return decodeMetaOAuthPending(match[1]);
  }
}
