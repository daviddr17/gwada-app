import "server-only";

import {
  buildMagicLinkEmailHtml,
  buildMagicLinkEmailText,
} from "@/lib/email/magic-link-email-html";
import { fetchTransactionalEmailBranding } from "@/lib/email/fetch-transactional-email-branding";
import { sendViaSmtp } from "@/lib/email/send-via-smtp";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import { resolveEmailSender } from "@/lib/email/email-delivery";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findAuthUserIdByEmailAdmin } from "@/lib/auth/find-auth-user-by-email";
import { isSignupAllowedForEmailAdmin } from "@/lib/auth/staff-invite-signup-gate";
import { GWADA_PUBLIC_SIGNUP_ENABLED } from "@/lib/auth/public-signup-gate";

export async function sendMagicLinkEmailServer(params: {
  email: string;
  origin: string;
  nextPath?: string | null;
  brandingClient?: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "invalid_email" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable" };
  }

  if (!GWADA_PUBLIC_SIGNUP_ENABLED) {
    const existingUserId = await findAuthUserIdByEmailAdmin(admin, email);
    if (!existingUserId) {
      const allowed = await isSignupAllowedForEmailAdmin(admin, email);
      if (!allowed) {
        // Kein Leak: gleiche Antwort wie bei unbekannter Adresse
        return { ok: true };
      }
    }
  }

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) {
    return { ok: false, error: "smtp_not_configured" };
  }

  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) {
    return { ok: false, error: "smtp_incomplete" };
  }

  const next = safeInternalPath(params.nextPath);
  const origin = params.origin.replace(/\/$/, "");
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error || !data.properties?.action_link) {
    console.warn("magic link generateLink", error?.message);
    return { ok: false, error: error?.message ?? "link_generation_failed" };
  }

  const branding = await fetchTransactionalEmailBranding(
    params.brandingClient ?? admin,
  );
  const sender = resolveEmailSender({
    useCustom: false,
    fromEmail: smtp.email,
    fromName: platformEmail.config.from_name ?? branding.appName,
  });

  const magicLink = data.properties.action_link;
  const emailContent = {
    appName: branding.appName,
    magicLink,
    logoUrl: branding.logoUrl,
  };

  const sent = await sendViaSmtp(smtp, {
    to: email,
    subject: `Anmeldung bei ${branding.appName}`,
    text: buildMagicLinkEmailText(emailContent),
    html: buildMagicLinkEmailHtml(emailContent),
    fromName: sender.name,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  return { ok: true };
}
