import "server-only";

import {
  buildTransactionalEmailHtmlFromText,
  buildTransactionalEmailTextFromParts,
} from "@/lib/email/transactional-email-from-text";
import { fetchTransactionalEmailBranding } from "@/lib/email/fetch-transactional-email-branding";
import { sendViaSmtp } from "@/lib/email/send-via-smtp";
import { resolveEmailSender } from "@/lib/email/email-delivery";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function fetchSuperadminEmails(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<string[]> {
  const { data, error } = await admin.from("platform_superadmins").select("profile_id");
  if (error) {
    console.warn("[ops] superadmin list", error.message);
    return [];
  }

  const emails: string[] = [];
  for (const row of data ?? []) {
    const profileId = (row as { profile_id: string }).profile_id;
    const { data: userData, error: userErr } =
      await admin.auth.admin.getUserById(profileId);
    if (userErr) continue;
    const email = userData.user?.email?.trim();
    if (email) emails.push(email);
  }
  return [...new Set(emails)];
}

export async function sendOpsAlertEmail(params: {
  subject: string;
  headline: string;
  text: string;
}): Promise<{ sent: number; skipped: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { sent: 0, skipped: "server_misconfigured" };

  const recipients = await fetchSuperadminEmails(admin);
  if (recipients.length === 0) return { sent: 0, skipped: "no_recipients" };

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) {
    return { sent: 0, skipped: "smtp_disabled" };
  }

  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) return { sent: 0, skipped: "smtp_incomplete" };

  const branding = await fetchTransactionalEmailBranding(admin);
  const sender = resolveEmailSender({
    useCustom: false,
    fromEmail: smtp.email,
    fromName: platformEmail.config.from_name ?? branding.appName,
  });

  const html = buildTransactionalEmailHtmlFromText({
    brandName: branding.appName,
    logoUrl: branding.logoUrl,
    headline: params.headline,
    intro: "On-Call: Zustellung oder Cron weicht vom SLO ab.",
    text: params.text,
    cta: {
      label: "Ops öffnen",
      href: "https://gwada.app/superadmin/ops",
    },
    footerNote: "Keine Secrets in dieser Mail — nur Zähler und Restaurantnamen.",
  });

  const plain = buildTransactionalEmailTextFromParts({
    headline: params.headline,
    intro: "On-Call: Zustellung oder Cron weicht vom SLO ab.",
    text: params.text,
    footerNote: "Keine Secrets in dieser Mail — nur Zähler und Restaurantnamen.",
  });

  let sent = 0;
  await Promise.all(
    recipients.map((to) =>
      sendViaSmtp(smtp, {
        to,
        subject: params.subject,
        text: plain,
        html,
        fromName: sender.name,
      })
        .then(() => {
          sent += 1;
        })
        .catch((err) => {
          console.warn("[ops] alert email failed", to, err instanceof Error ? err.message : err);
        }),
    ),
  );

  return { sent, skipped: sent === 0 ? "send_failed" : null };
}
