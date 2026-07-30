import "server-only";

import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const INVITE_TTL_DAYS = 30;
export const MANUAL_REVIEW_INVITE_TTL_HOURS = 24;

import {
  hasAnyReviewInclude,
  reviewIncludesFromRow,
  type ReviewRequestChannel,
  type ReviewRequestIncludes,
} from "@/lib/reviews/review-request-settings";

export type ReviewRequestSettings = ReviewRequestIncludes & {
  review_google_url: string | null;
  review_facebook_url: string | null;
};

export function reviewRequestSettingsFromRow(
  row: Record<string, unknown> | null | undefined,
  channel: ReviewRequestChannel,
): ReviewRequestSettings {
  const includes = reviewIncludesFromRow(row, channel);
  return {
    ...includes,
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

export { hasAnyReviewInclude };

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function reviewInvitationPublicUrl(
  origin: string,
  token: string,
): string {
  return `${origin.replace(/\/$/, "")}/bewertung/${token}`;
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
    .select("id, token, completed_at, expires_at")
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
  const expiresIso = expiresAt.toISOString();

  // Partial unique index (WHERE reservation_id IS NOT NULL) — PostgREST-upsert
  // mit onConflict: "reservation_id" schlägt dort fehl → Token blieb null →
  // Danke-Nachricht ohne Bewertungslink. Deshalb insert/update statt upsert.
  if (existing?.id) {
    const { error } = await admin
      .from("gwada_review_invitations")
      .update({
        token,
        expires_at: expiresIso,
        completed_at: null,
      })
      .eq("id", existing.id);
    if (error) {
      console.warn("gwada review invitation update", error.message);
      return null;
    }
    return { token };
  }

  const { error: insertErr } = await admin.from("gwada_review_invitations").insert({
    restaurant_id: params.restaurantId,
    reservation_id: params.reservationId,
    token,
    expires_at: expiresIso,
    completed_at: null,
  });

  if (!insertErr) return { token };

  // Race: parallel angelegt — vorhandenen gültigen Token nutzen
  const { data: raced } = await admin
    .from("gwada_review_invitations")
    .select("token, completed_at, expires_at")
    .eq("reservation_id", params.reservationId)
    .maybeSingle();
  if (raced?.token && !raced.completed_at) {
    const exp = new Date(raced.expires_at as string);
    if (exp.getTime() > Date.now()) {
      return { token: raced.token as string };
    }
  }

  console.warn("gwada review invitation insert", insertErr.message);
  return null;
}

export function buildReviewRequestBlock(params: {
  origin: string;
  settings: ReviewRequestSettings;
  invitationToken: string | null;
  googleReviewUrl?: string | null;
  facebookReviewUrl?: string | null;
}): string {
  if (!hasAnyReviewInclude(params.settings)) return "";

  const lines: string[] = ["", "⭐ Deine Bewertung hilft uns sehr:"];

  if (params.settings.includeGwada && params.invitationToken) {
    const url = `${params.origin.replace(/\/$/, "")}/bewertung/${params.invitationToken}`;
    lines.push(`Gwada: ${url}`);
  }

  const googleUrl =
    params.settings.review_google_url?.trim() ||
    params.googleReviewUrl?.trim() ||
    null;
  if (params.settings.includeGoogle && googleUrl) {
    lines.push(`Google: ${googleUrl}`);
  }

  const fbUrl =
    params.settings.review_facebook_url?.trim() ||
    params.facebookReviewUrl?.trim() ||
    null;
  if (params.settings.includeFacebook && fbUrl) {
    lines.push(`Facebook: ${fbUrl}`);
  }

  if (lines.length <= 2) return "";
  return lines.join("\n");
}

/** Testversand: keine Einladungs-URLs, nur Anzeige welche Kanäle angehängt würden. */
export function buildReviewRequestPreviewBlock(params: {
  settings: ReviewRequestSettings;
  googleReviewUrl?: string | null;
  facebookReviewUrl?: string | null;
}): string {
  if (!hasAnyReviewInclude(params.settings)) return "";

  const lines: string[] = [
    "",
    "Bewertungslinks (so bei echter Danke-Nachricht):",
  ];

  if (params.settings.includeGwada) {
    lines.push(
      "Gwada: persönlicher Einladungslink pro Reservierung (wird beim Versand erzeugt)",
    );
  }

  const googleUrl =
    params.settings.review_google_url?.trim() ||
    params.googleReviewUrl?.trim() ||
    null;
  if (params.settings.includeGoogle) {
    lines.push(
      googleUrl
        ? `Google: ${googleUrl}`
        : "Google: Link aus Einstellung oder Google-Business-Integration",
    );
  }

  const fbUrl =
    params.settings.review_facebook_url?.trim() ||
    params.facebookReviewUrl?.trim() ||
    null;
  if (params.settings.includeFacebook) {
    lines.push(
      fbUrl
        ? `Facebook: ${fbUrl}`
        : "Facebook: Link aus Einstellung oder Facebook-Integration",
    );
  }

  if (lines.length <= 2) return "";
  return lines.join("\n");
}
