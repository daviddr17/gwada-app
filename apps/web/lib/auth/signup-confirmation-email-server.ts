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

export async function sendSignupConfirmationEmail(params: {
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
