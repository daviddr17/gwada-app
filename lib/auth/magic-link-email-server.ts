import "server-only";

import { sendViaSmtp } from "@/lib/email/send-via-smtp";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import { resolveEmailSender } from "@/lib/n8n/n8n-send-reservation-email";
import { fetchPlatformAppBranding } from "@/lib/supabase/platform-app-settings-db";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import type { SupabaseClient } from "@supabase/supabase-js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function magicLinkEmailHtml(params: {
  appName: string;
  magicLink: string;
}): string {
  const appName = escapeHtml(params.appName);
  const href = escapeHtml(params.magicLink);
  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:24px;font-family:sans-serif;background:#f8fafc;color:#0f172a;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
    <p style="margin:0 0 12px;font-size:16px;font-weight:600;">Anmeldung bei ${appName}</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">
      Klicke auf den Button, um dich anzumelden. Der Link ist nur kurze Zeit gültig.
    </p>
    <p style="margin:0 0 20px;">
      <a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#14532d;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
        Jetzt anmelden
      </a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
      Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br />
      <span style="word-break:break-all;">${href}</span>
    </p>
  </div>
</body>
</html>`;
}

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

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) {
    return { ok: false, error: "smtp_not_configured" };
  }

  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) {
    return { ok: false, error: "smtp_incomplete" };
  }

  const next = safeInternalPath(params.nextPath);
  const redirectTo = `${params.origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error || !data.properties?.action_link) {
    console.warn("magic link generateLink", error?.message);
    return { ok: false, error: error?.message ?? "link_generation_failed" };
  }

  const brandingClient = params.brandingClient ?? admin;
  const branding = await fetchPlatformAppBranding(brandingClient);
  const sender = resolveEmailSender({
    useCustom: false,
    fromEmail: smtp.email,
    fromName: platformEmail.config.from_name ?? branding.appName,
  });

  const magicLink = data.properties.action_link;
  const text = [
    `Anmeldung bei ${branding.appName}`,
    "",
    "Klicke auf den Link, um dich anzumelden:",
    magicLink,
    "",
    "Der Link ist nur kurze Zeit gültig.",
  ].join("\n");

  const sent = await sendViaSmtp(smtp, {
    to: email,
    subject: `Dein Anmelde-Link — ${branding.appName}`,
    text,
    html: magicLinkEmailHtml({
      appName: branding.appName,
      magicLink,
    }),
    fromName: sender.name,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  return { ok: true };
}
