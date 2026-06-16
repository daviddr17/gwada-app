import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Mindestzeit zwischen Formular-Anzeige und Absenden (Bots sind schneller). */
export const PROFILE_CONTACT_MIN_SUBMIT_MS = 2_500;

/** Formular-Token älter als dieser Wert wird verworfen (Replay-Schutz). */
export const PROFILE_CONTACT_MAX_SUBMIT_AGE_MS = 4 * 60 * 60 * 1000;

const PROFILE_CONTACT_RATE_WINDOW_MS = 15 * 60 * 1000;
const PROFILE_CONTACT_RATE_MAX = 3;
const PROFILE_CONTACT_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export type ProfileContactSpamInput = {
  website?: string | null;
  opened_at?: number | null;
};

export function profileContactHoneypotFilled(
  website: string | null | undefined,
): boolean {
  return Boolean(website?.trim());
}

export function profileContactSubmitTimingInvalid(
  openedAt: number | null | undefined,
  now = Date.now(),
): boolean {
  if (openedAt == null || !Number.isFinite(openedAt)) return true;
  const elapsed = now - openedAt;
  if (elapsed < PROFILE_CONTACT_MIN_SUBMIT_MS) return true;
  if (elapsed > PROFILE_CONTACT_MAX_SUBMIT_AGE_MS) return true;
  return false;
}

export function isProfileContactSpamAttempt(input: ProfileContactSpamInput): boolean {
  if (profileContactHoneypotFilled(input.website)) return true;
  if (profileContactSubmitTimingInvalid(input.opened_at ?? null)) return true;
  return false;
}

export async function isProfileContactRateLimited(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    message: string;
  },
): Promise<boolean> {
  const since = new Date(
    Date.now() - PROFILE_CONTACT_RATE_WINDOW_MS,
  ).toISOString();

  const { count: recentCount } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .eq("platform", "gwada")
    .eq("direction", "inbound")
    .like("external_source_id", "profile-contact:%")
    .gte("created_at", since);

  if ((recentCount ?? 0) >= PROFILE_CONTACT_RATE_MAX) {
    return true;
  }

  const duplicateSince = new Date(
    Date.now() - PROFILE_CONTACT_DUPLICATE_WINDOW_MS,
  ).toISOString();

  const { count: duplicateCount } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .eq("platform", "gwada")
    .eq("direction", "inbound")
    .eq("body", params.message)
    .gte("created_at", duplicateSince);

  return (duplicateCount ?? 0) > 0;
}

/** Erfolg ohne Zustellung — Bots sollen keinen Hinweis bekommen. */
export const PROFILE_CONTACT_SPAM_ACCEPTED = {
  ok: true as const,
  messageId: "accepted",
};
