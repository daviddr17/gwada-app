import "server-only";

import {
  buildSignupConfirmationEmailHtml,
  buildSignupConfirmationEmailText,
} from "@/lib/email/signup-confirmation-email-html";
import { fetchTransactionalEmailBranding } from "@/lib/email/fetch-transactional-email-branding";
import { sendViaSmtp } from "@/lib/email/send-via-smtp";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import { resolveEmailSender } from "@/lib/email/email-delivery";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
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

async function sendSignupConfirmationEmail(params: {
  email: string;
  confirmLink: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable" };
  }

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) {
    return { ok: false, error: "smtp_not_configured" };
  }

  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) {
    return { ok: false, error: "smtp_incomplete" };
  }

  const branding = await fetchTransactionalEmailBranding(admin);
  const sender = resolveEmailSender({
    useCustom: false,
    fromEmail: smtp.email,
    fromName: platformEmail.config.from_name ?? branding.appName,
  });

  const emailContent = {
    appName: branding.appName,
    confirmLink: params.confirmLink,
    logoUrl: branding.logoUrl,
  };

  const sent = await sendViaSmtp(smtp, {
    to: params.email,
    subject: `E-Mail bestätigen — ${branding.appName}`,
    text: buildSignupConfirmationEmailText(emailContent),
    html: buildSignupConfirmationEmailHtml(emailContent),
    fromName: sender.name,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  return { ok: true };
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

  const inviteEmail = preview.invite.staff_email
    ? normalizeEmail(preview.invite.staff_email)
    : null;
  if (inviteEmail && inviteEmail !== email) {
    return {
      ok: false,
      error: "email_mismatch",
      message: "Bitte die E-Mail-Adresse aus der Einladung verwenden.",
    };
  }

  const nextPath = safeInternalPath(`/einladung/${encodeURIComponent(token)}`);
  const origin = params.origin.replace(/\/$/, "");
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const metadata = {
    given_name: params.givenName.trim(),
    family_name: params.familyName.trim(),
  };

  const linkResult = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: params.password,
    options: { redirectTo, data: metadata },
  });

  let confirmLink = linkResult.data?.properties?.action_link ?? null;

  if (linkResult.error || !confirmLink) {
    if (!isAlreadyRegisteredError(linkResult.error?.message)) {
      console.warn("[staff-invite-register] generateLink signup", linkResult.error?.message);
      return {
        ok: false,
        error: "signup_failed",
        message:
          linkResult.error?.message ??
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

    const resend = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: params.password,
      options: { redirectTo, data: metadata },
    });
    confirmLink = resend.data?.properties?.action_link ?? null;
    if (resend.error || !confirmLink) {
      console.warn("[staff-invite-register] generateLink resend", resend.error?.message);
      return {
        ok: false,
        error: "signup_failed",
        message: "Bestätigungs-Link konnte nicht erstellt werden.",
      };
    }
  }

  const sent = await sendSignupConfirmationEmail({ email, confirmLink });
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
