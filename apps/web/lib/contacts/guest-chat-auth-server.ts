import "server-only";

import { createHash, randomBytes } from "crypto";
import { buildGuestChatUrl } from "@/lib/contacts/guest-chat-url";
import {
  DEFAULT_GUEST_CHAT_CODE_VALID_HOURS,
  DEFAULT_GUEST_CHAT_SESSION_HOURS,
  GUEST_CHAT_ATTEMPT_WINDOW_MS,
  GUEST_CHAT_MAX_CODES_PER_CONTACT_PER_DAY,
  GUEST_CHAT_MAX_FAILED_ATTEMPTS,
  GUEST_CHAT_RESEND_COOLDOWN_MS,
} from "@/lib/contacts/guest-chat-constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export function hashGuestChatSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateGuestChatToken(): string {
  return randomBytes(32).toString("hex");
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function ipHashFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
  return hashGuestChatSecret(ip);
}

export async function fetchGuestChatAuthSettings(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ codeValidHours: number; sessionHours: number; urlTemplate: string | null }> {
  const { data } = await admin
    .from("restaurant_contact_settings")
    .select(
      "guest_chat_url_template, guest_chat_code_valid_hours, guest_chat_session_hours",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const row = data as {
    guest_chat_url_template: string | null;
    guest_chat_code_valid_hours: number;
    guest_chat_session_hours: number;
  } | null;

  return {
    urlTemplate: row?.guest_chat_url_template ?? null,
    codeValidHours: row?.guest_chat_code_valid_hours ?? DEFAULT_GUEST_CHAT_CODE_VALID_HOURS,
    sessionHours: row?.guest_chat_session_hours ?? DEFAULT_GUEST_CHAT_SESSION_HOURS,
  };
}

export type IssuedGuestLoginCode = {
  code: string;
  chatUrl: string;
  expiresAt: string;
};

/** Neuen 6-stelligen Code ausstellen (alte ungenutzte Codes verfallen logisch durch Ablauf). */
export async function issueGuestLoginCode(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    validHours?: number;
  },
): Promise<IssuedGuestLoginCode | null> {
  const settings = await fetchGuestChatAuthSettings(admin, params.restaurantId);
  const hours = params.validHours ?? settings.codeValidHours;
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("contact_guest_login_codes").insert({
    restaurant_id: params.restaurantId,
    contact_id: params.contactId,
    code_hash: hashGuestChatSecret(code),
    expires_at: expiresAt,
  });

  if (error) {
    console.warn("[gwada] issueGuestLoginCode", error.message);
    return null;
  }

  return {
    code,
    chatUrl: buildGuestChatUrl(settings.urlTemplate, params.contactId),
    expiresAt,
  };
}

async function countRecentFailedAttempts(
  admin: SupabaseClient,
  contactId: string,
  ipHash: string,
): Promise<number> {
  const since = new Date(Date.now() - GUEST_CHAT_ATTEMPT_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("contact_guest_auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .eq("ip_hash", ipHash)
    .eq("success", false)
    .gte("created_at", since);

  if (error) return 0;
  return count ?? 0;
}

async function recordAuthAttempt(
  admin: SupabaseClient,
  contactId: string,
  ipHash: string,
  success: boolean,
): Promise<void> {
  await admin.from("contact_guest_auth_attempts").insert({
    contact_id: contactId,
    ip_hash: ipHash,
    success,
  });
}

async function findValidLoginCode(
  admin: SupabaseClient,
  contactId: string,
  code: string,
): Promise<{ id: string; restaurantId: string } | null> {
  const now = new Date().toISOString();
  const { data: rows } = await admin
    .from("contact_guest_login_codes")
    .select("id, restaurant_id, code_hash")
    .eq("contact_id", contactId)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(20);

  const hash = hashGuestChatSecret(code.trim());
  for (const row of rows ?? []) {
    const r = row as { id: string; restaurant_id: string; code_hash: string };
    if (r.code_hash === hash) {
      return { id: r.id, restaurantId: r.restaurant_id };
    }
  }
  return null;
}

export async function verifyGuestLoginCode(
  admin: SupabaseClient,
  params: {
    contactId: string;
    code: string;
    req: Request;
  },
): Promise<
  | { ok: true; restaurantId: string; sessionToken: string; sessionId: string; expiresAt: string }
  | { ok: false; error: string; status: number }
> {
  const pin = params.code.trim();
  if (!/^[0-9]{6}$/.test(pin)) {
    return { ok: false, error: "invalid_code", status: 400 };
  }

  const ipHash = ipHashFromRequest(params.req);
  const failed = await countRecentFailedAttempts(
    admin,
    params.contactId,
    ipHash,
  );
  if (failed >= GUEST_CHAT_MAX_FAILED_ATTEMPTS) {
    return { ok: false, error: "rate_limited", status: 429 };
  }

  const match = await findValidLoginCode(admin, params.contactId, pin);
  if (!match) {
    await recordAuthAttempt(admin, params.contactId, ipHash, false);
    return { ok: false, error: "invalid_code", status: 401 };
  }

  await recordAuthAttempt(admin, params.contactId, ipHash, true);

  await admin
    .from("contact_guest_login_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", match.id);

  const settings = await fetchGuestChatAuthSettings(admin, match.restaurantId);
  const sessionToken = generateGuestChatToken();
  const expiresAt = new Date(
    Date.now() + settings.sessionHours * 60 * 60 * 1000,
  ).toISOString();

  const { data: session, error } = await admin
    .from("contact_guest_sessions")
    .insert({
      restaurant_id: match.restaurantId,
      contact_id: params.contactId,
      token_hash: hashGuestChatSecret(sessionToken),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !session) {
    return { ok: false, error: "session_failed", status: 500 };
  }

  return {
    ok: true,
    restaurantId: match.restaurantId,
    sessionToken,
    sessionId: (session as { id: string }).id,
    expiresAt,
  };
}

export async function resolveGuestSessionFromCookie(
  admin: SupabaseClient,
  params: {
    contactId: string;
    sessionId: string;
    sessionToken: string;
  },
): Promise<{ contactId: string; restaurantId: string; sessionId: string } | null> {
  const now = new Date().toISOString();
  const { data: row } = await admin
    .from("contact_guest_sessions")
    .select("id, contact_id, restaurant_id, token_hash, expires_at")
    .eq("id", params.sessionId)
    .eq("contact_id", params.contactId)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (!row) return null;
  const r = row as {
    id: string;
    contact_id: string;
    restaurant_id: string;
    token_hash: string;
  };
  if (r.token_hash !== hashGuestChatSecret(params.sessionToken)) return null;

  await admin
    .from("contact_guest_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", r.id);

  return {
    contactId: r.contact_id,
    restaurantId: r.restaurant_id,
    sessionId: r.id,
  };
}

export async function lastCodeSentAt(
  admin: SupabaseClient,
  contactId: string,
): Promise<Date | null> {
  const { data } = await admin
    .from("contact_guest_login_codes")
    .select("created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const created = (data as { created_at: string } | null)?.created_at;
  return created ? new Date(created) : null;
}

export function canResendGuestCode(lastSent: Date | null): boolean {
  if (!lastSent) return true;
  return Date.now() - lastSent.getTime() >= GUEST_CHAT_RESEND_COOLDOWN_MS;
}

export async function hasValidUnusedGuestLoginCode(
  admin: SupabaseClient,
  contactId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { count, error } = await admin
    .from("contact_guest_login_codes")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .is("consumed_at", null)
    .gt("expires_at", now);

  if (error) return false;
  return (count ?? 0) > 0;
}

export async function countGuestLoginCodesIssuedSince(
  admin: SupabaseClient,
  contactId: string,
  sinceMs: number,
): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { count, error } = await admin
    .from("contact_guest_login_codes")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .gte("created_at", since);

  if (error) return 0;
  return count ?? 0;
}

export function canIssueAnotherGuestLoginCode(issuedLast24h: number): boolean {
  return issuedLast24h < GUEST_CHAT_MAX_CODES_PER_CONTACT_PER_DAY;
}
