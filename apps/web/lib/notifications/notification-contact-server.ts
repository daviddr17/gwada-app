import "server-only";

import {
  normalizeNotificationEmail,
  normalizeNotificationPhoneForStorage,
  validateNotificationEmail,
  validateNotificationPhone,
} from "@/lib/notifications/notification-contact-validation";
import type { NotificationContact } from "@/lib/notifications/notification-contact-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { NotificationContact } from "@/lib/notifications/notification-contact-types";

export function resolveEffectiveNotificationEmail(
  notificationEmail: string | null | undefined,
  authEmail: string | null | undefined,
): string {
  const stored = normalizeNotificationEmail(notificationEmail);
  if (stored) return stored;
  return normalizeNotificationEmail(authEmail) ?? "";
}

export async function loadNotificationContact(
  sb: SupabaseClient,
  profileId: string,
): Promise<NotificationContact | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || user.id !== profileId) return null;

  const { data: profile, error } = await sb
    .from("profiles")
    .select("notification_email, phone")
    .eq("id", profileId)
    .maybeSingle();

  if (error) return null;

  const notificationEmail =
    typeof profile?.notification_email === "string"
      ? profile.notification_email.trim()
      : "";
  const phone =
    typeof profile?.phone === "string" ? profile.phone.trim() : "";
  const authEmail = user.email?.trim() ?? "";

  return {
    notificationEmail,
    phone,
    authEmail,
    effectiveEmail: resolveEffectiveNotificationEmail(
      notificationEmail,
      authEmail,
    ),
  };
}

export async function updateNotificationContact(
  sb: SupabaseClient,
  profileId: string,
  draft: { notificationEmail: string; phone: string },
): Promise<
  | { ok: true; contact: NotificationContact }
  | { ok: false; error: string; field?: "notificationEmail" | "phone" }
> {
  const emailError = validateNotificationEmail(draft.notificationEmail);
  if (emailError) {
    return { ok: false, error: emailError, field: "notificationEmail" };
  }

  const phoneError = validateNotificationPhone(draft.phone);
  if (phoneError) {
    return { ok: false, error: phoneError, field: "phone" };
  }

  const notificationEmail = normalizeNotificationEmail(draft.notificationEmail);
  const phone = normalizeNotificationPhoneForStorage(draft.phone);

  const { error } = await sb
    .from("profiles")
    .update({
      notification_email: notificationEmail,
      phone,
    })
    .eq("id", profileId);

  if (error) {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  const contact = await loadNotificationContact(sb, profileId);
  if (!contact) {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  return { ok: true, contact };
}
