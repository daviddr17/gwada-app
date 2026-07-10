import "server-only";

import {
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
} from "@/lib/email/password-reset-email-html";
import { fetchTransactionalEmailBranding } from "@/lib/email/fetch-transactional-email-branding";
import { sendViaSmtp } from "@/lib/email/send-via-smtp";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import { resolveEmailSender } from "@/lib/email/email-delivery";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { generateAdminAuthActionLink } from "@/lib/auth/generate-admin-auth-action-link";
import type { PreparedAuthEmailJob } from "@/lib/auth/auth-email-background-dispatch";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_RESET_NEXT = "/auth/neues-passwort";

type PrepareResult =
  | { ok: true; prepared: PreparedAuthEmailJob }
  | { ok: false; error: string; fatal: boolean };

export async function preparePasswordResetEmailServer(params: {
  email: string;
  origin: string;
  nextPath?: string | null;
  brandingClient?: SupabaseClient;
}): Promise<PrepareResult> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "invalid_email", fatal: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable", fatal: true };
  }

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) {
    return { ok: false, error: "smtp_not_configured", fatal: true };
  }

  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) {
    return { ok: false, error: "smtp_incomplete", fatal: true };
  }

  const next = safeInternalPath(params.nextPath ?? DEFAULT_RESET_NEXT);
  const origin = params.origin.replace(/\/$/, "");
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const linkResult = await generateAdminAuthActionLink(
    admin,
    {
      type: "recovery",
      email,
      options: { redirectTo },
    },
    { siteUrl: origin, redirectTo, nextPath: next },
  );

  if (!linkResult.ok) {
    console.warn("password reset generateLink", linkResult.error);
    return { ok: true, prepared: { kind: "noop" } };
  }

  const branding = await fetchTransactionalEmailBranding(
    params.brandingClient ?? admin,
  );
  const sender = resolveEmailSender({
    useCustom: false,
    fromEmail: smtp.email,
    fromName: platformEmail.config.from_name ?? branding.appName,
  });

  const emailContent = {
    appName: branding.appName,
    resetLink: linkResult.actionLink,
    logoUrl: branding.logoUrl,
  };

  return {
    ok: true,
    prepared: {
      kind: "send",
      smtp,
      logLabel: "forgot-password",
      payload: {
        to: email,
        subject: `Passwort zurücksetzen — ${branding.appName}`,
        text: buildPasswordResetEmailText(emailContent),
        html: buildPasswordResetEmailHtml(emailContent),
        fromName: sender.name,
      },
    },
  };
}

/** @deprecated Prefer prepare + scheduleAuthEmailInBackground in API routes. */
export async function sendPasswordResetEmailServer(params: {
  email: string;
  origin: string;
  nextPath?: string | null;
  brandingClient?: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const prepared = await preparePasswordResetEmailServer(params);
  if (!prepared.ok) {
    return { ok: false, error: prepared.error };
  }
  if (prepared.prepared.kind === "noop") {
    return { ok: true };
  }
  const sent = await sendViaSmtp(
    prepared.prepared.smtp,
    prepared.prepared.payload,
  );
  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }
  return { ok: true };
}
