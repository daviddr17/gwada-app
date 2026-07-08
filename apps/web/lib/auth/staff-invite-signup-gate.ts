import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { GWADA_PUBLIC_SIGNUP_ENABLED } from "@/lib/auth/public-signup-gate";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Ausstehende Staff-Einladung für diese E-Mail (Service-Role / RPC). */
export async function emailHasPendingStaffInviteAdmin(
  admin: SupabaseClient,
  email: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) return false;

  const { data, error } = await admin.rpc("email_has_pending_staff_invite", {
    p_email: normalized,
  });

  if (error) {
    console.warn("[auth] email_has_pending_staff_invite", error.message);
    return false;
  }

  return data === true;
}

/** Registrierung erlaubt: öffentlich frei oder Staff-Einladung offen. */
export async function isSignupAllowedForEmailAdmin(
  admin: SupabaseClient,
  email: string | null | undefined,
): Promise<boolean> {
  if (GWADA_PUBLIC_SIGNUP_ENABLED) return true;
  if (!email?.trim()) return false;
  return emailHasPendingStaffInviteAdmin(admin, email);
}

/** OAuth/Magic-Link-Rückkehr direkt auf Einladungsseite — neues Konto zulassen. */
export function isInviteSignupNextPath(next: string | null | undefined): boolean {
  const path = safeInternalPath(next);
  return path.startsWith("/einladung/") && path.length > "/einladung/".length;
}
