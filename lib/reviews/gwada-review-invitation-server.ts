import "server-only";

import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const INVITE_TTL_DAYS = 30;

export type ReviewRequestSettings = {
  review_request_enabled: boolean;
  review_request_include_gwada: boolean;
  review_request_include_google: boolean;
  review_request_include_facebook: boolean;
  review_google_url: string | null;
  review_facebook_url: string | null;
};

export function reviewRequestSettingsFromRow(
  row: Record<string, unknown> | null | undefined,
): ReviewRequestSettings {
  return {
    review_request_enabled: Boolean(row?.review_request_enabled),
    review_request_include_gwada: row?.review_request_include_gwada !== false,
    review_request_include_google: Boolean(row?.review_request_include_google),
    review_request_include_facebook: Boolean(row?.review_request_include_facebook),
    review_google_url:
      typeof row?.review_google_url === "string"
        ? row.review_google_url.trim() || null
        : null,
    review_facebook_url:
      typeof row?.review_facebook_url === "string"
        ? row.review_facebook_url.trim() || null
        : null,
  };
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function ensureGwadaReviewInvitation(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    reservationId: string;
  },
): Promise<{ token: string } | null> {
  const { data: existing } = await admin
    .from("gwada_review_invitations")
    .select("token, completed_at, expires_at")
    .eq("reservation_id", params.reservationId)
    .maybeSingle();

  if (existing?.token && !existing.completed_at) {
    const exp = new Date(existing.expires_at as string);
    if (exp.getTime() > Date.now()) {
      return { token: existing.token as string };
    }
  }

  const token = newToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const { error } = await admin.from("gwada_review_invitations").upsert(
    {
      restaurant_id: params.restaurantId,
      reservation_id: params.reservationId,
      token,
      expires_at: expiresAt.toISOString(),
      completed_at: null,
    },
    { onConflict: "reservation_id" },
  );

  if (error) {
    console.warn("gwada review invitation", error.message);
    return null;
  }

  return { token };
}

export function buildReviewRequestBlock(params: {
  origin: string;
  settings: ReviewRequestSettings;
  invitationToken: string | null;
  googleReviewUrl?: string | null;
  facebookReviewUrl?: string | null;
}): string {
  if (!params.settings.review_request_enabled) return "";

  const lines: string[] = ["", "⭐ Deine Bewertung hilft uns sehr:"];

  if (params.settings.review_request_include_gwada && params.invitationToken) {
    const url = `${params.origin.replace(/\/$/, "")}/bewertung/${params.invitationToken}`;
    lines.push(`Gwada: ${url}`);
  }

  const googleUrl =
    params.settings.review_google_url?.trim() ||
    params.googleReviewUrl?.trim() ||
    null;
  if (params.settings.review_request_include_google && googleUrl) {
    lines.push(`Google: ${googleUrl}`);
  }

  const fbUrl =
    params.settings.review_facebook_url?.trim() ||
    params.facebookReviewUrl?.trim() ||
    null;
  if (params.settings.review_request_include_facebook && fbUrl) {
    lines.push(`Facebook: ${fbUrl}`);
  }

  if (lines.length <= 2) return "";
  return lines.join("\n");
}
