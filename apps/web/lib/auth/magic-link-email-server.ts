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
import { generateAdminAuthActionLink } from "@/lib/auth/generate-admin-auth-action-link";
import { isSignupAllowedForEmailAdmin } from "@/lib/auth/staff-invite-signup-gate";
import { GWADA_PUBLIC_SIGNUP_ENABLED } from "@/lib/auth/public-signup-gate";
import type { PreparedAuthEmailJob } from "@/lib/auth/auth-email-background-dispatch";

type PrepareResult =
  | { ok: true; prepared: PreparedAuthEmailJob }
  | { ok: false; error: string; fatal: boolean };

export async function prepareMagicLinkEmailServer(params: {
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

  if (!GWADA_PUBLIC_SIGNUP_ENABLED) {
    const existingUserId = await findAuthUserIdByEmailAdmin(admin, email);
    if (!existingUserId) {
      const allowed = await isSignupAllowedForEmailAdmin(admin, email);
      if (!allowed) {
        return { ok: true, prepared: { kind: "noop" } };
      }
    }
  }

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) {
    return { ok: false, error: "smtp_not_configured", fatal: true };
  }

  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) {
    return { ok: false, error: "smtp_incomplete", fatal: true };
  }

  const next = safeInternalPath(params.nextPath);
  const origin = params.origin.replace(/\/$/, "");
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const linkResult = await generateAdminAuthActionLink(
    admin,
    {
      type: "magiclink",
      email,
      options: { redirectTo },
    },
    { siteUrl: origin, redirectTo, nextPath: next },
  );

  if (!linkResult.ok) {
    console.warn("magic link generateLink", linkResult.error);
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

  const magicLink = linkResult.actionLink;
  const emailContent = {
    appName: branding.appName,
    magicLink,
    logoUrl: branding.logoUrl,
  };

  return {
    ok: true,
    prepared: {
      kind: "send",
      smtp,
      logLabel: "magic-link",
      payload: {
        to: email,
        subject: `Anmeldung bei ${branding.appName}`,
        text: buildMagicLinkEmailText(emailContent),
        html: buildMagicLinkEmailHtml(emailContent),
        fromName: sender.name,
      },
    },
  };
}

/** @deprecated Prefer prepare + scheduleAuthEmailInBackground in API routes. */
export async function sendMagicLinkEmailServer(params: {
  email: string;
  origin: string;
  nextPath?: string | null;
  brandingClient?: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const prepared = await prepareMagicLinkEmailServer(params);
  if (!prepared.ok) {
    if (!prepared.fatal) {
      return { ok: true };
    }
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
