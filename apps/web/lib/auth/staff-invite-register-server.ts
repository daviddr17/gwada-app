import "server-only";

import { buildSignupConfirmationLinkAdmin } from "@/lib/auth/signup-confirmation-link-admin";
import { sendSignupConfirmationEmail } from "@/lib/auth/signup-confirmation-email-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { findAuthUserIdByEmailAdmin } from "@/lib/auth/find-auth-user-by-email";
import {
  normalizeStaffInviteToken,
  resolveStaffInvitePreview,
} from "@/lib/staff/staff-invite-preview-server";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAlreadyRegisteredError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already registered")
  );
}

export async function registerStaffInviteAccountServer(params: {
  token: string;
  email: string;
  password: string;
  givenName: string;
  familyName: string;
  origin: string;
}): Promise<
  | { ok: true; needsConfirmation: true }
  | { ok: false; error: string; message: string }
> {
  const email = normalizeEmail(params.email);
  if (!email.includes("@")) {
    return { ok: false, error: "invalid_email", message: "Ungültige E-Mail." };
  }
  if (params.password.length < 8) {
    return {
      ok: false,
      error: "weak_password",
      message: "Passwort mindestens 8 Zeichen.",
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "admin_unavailable",
      message: "Registrierung vorübergehend nicht verfügbar.",
    };
  }

  const token = normalizeStaffInviteToken(params.token);
  const preview = await resolveStaffInvitePreview(admin, token);
  if (!preview.ok) {
    return {
      ok: false,
      error: preview.error,
      message: "Einladung ungültig oder abgelaufen.",
    };
  }

  const nextPath = safeInternalPath(`/einladung/${encodeURIComponent(token)}`);
  const origin = params.origin.replace(/\/$/, "");
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const metadata = {
    given_name: params.givenName.trim(),
    family_name: params.familyName.trim(),
  };

  let linkResult = await buildSignupConfirmationLinkAdmin(admin, {
    email,
    password: params.password,
    redirectTo,
    data: metadata,
    siteUrl: origin,
  });

  if (!linkResult.ok) {
    if (!isAlreadyRegisteredError(linkResult.error)) {
      console.warn("[staff-invite-register] generateLink signup", linkResult.error);
      return {
        ok: false,
        error: "signup_failed",
        message:
          linkResult.error ??
          "Registrierung fehlgeschlagen. Bitte erneut versuchen.",
      };
    }

    const existingUserId = await findAuthUserIdByEmailAdmin(admin, email);
    if (!existingUserId) {
      return {
        ok: false,
        error: "signup_failed",
        message: "Registrierung fehlgeschlagen. Bitte erneut versuchen.",
      };
    }

    const { data: existingUser, error: getUserError } =
      await admin.auth.admin.getUserById(existingUserId);
    if (getUserError || !existingUser.user) {
      return {
        ok: false,
        error: "signup_failed",
        message: "Registrierung fehlgeschlagen.",
      };
    }

    if (existingUser.user.email_confirmed_at) {
      return {
        ok: false,
        error: "already_registered",
        message:
          "Für diese E-Mail existiert bereits ein Konto — bitte anmelden und die Einladung annehmen.",
      };
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      existingUserId,
      {
        password: params.password,
        user_metadata: metadata,
      },
    );
    if (updateError) {
      console.warn("[staff-invite-register] updateUserById", updateError.message);
      return {
        ok: false,
        error: "signup_failed",
        message: "Konto konnte nicht aktualisiert werden.",
      };
    }

    linkResult = await buildSignupConfirmationLinkAdmin(admin, {
      email,
      password: params.password,
      redirectTo,
      data: metadata,
      siteUrl: origin,
    });
    if (!linkResult.ok) {
      console.warn("[staff-invite-register] generateLink resend", linkResult.error);
      return {
        ok: false,
        error: "signup_failed",
        message: "Bestätigungs-Link konnte nicht erstellt werden.",
      };
    }
  }

  const sent = await sendSignupConfirmationEmail({
    email,
    confirmLink: linkResult.confirmLink,
  });
  if (!sent.ok) {
    if (sent.error === "smtp_not_configured" || sent.error === "smtp_incomplete") {
      return {
        ok: false,
        error: sent.error,
        message:
          "E-Mail-Versand ist nicht eingerichtet — bitte dein Restaurant kontaktieren.",
      };
    }
    return {
      ok: false,
      error: sent.error,
      message: "Bestätigungs-E-Mail konnte nicht gesendet werden.",
    };
  }

  return { ok: true, needsConfirmation: true };
}
