import { assertBillingFeature } from "@/lib/billing/assert-billing-feature";
import {
  GWADA_DEFAULT_FROM_EMAIL,
  GWADA_DEFAULT_FROM_NAME,
} from "@/lib/constants/gwada-email-defaults";
import { assertPlatformEmailEnabled } from "@/lib/integrations/platform-messaging-guard";
import {
  mergeSmtpPassword,
  validateSmtpConfigForSave,
} from "@/lib/integrations/smtp-integration-config";
import { getGmailOAuthPlatformConfigAdmin } from "@/lib/integrations/gmail-oauth";
import { getOutlookOAuthPlatformConfigAdmin } from "@/lib/integrations/outlook-oauth";
import { isRestaurantEmailMailboxStatus } from "@/lib/email/restaurant-email-mailbox";
import {
  parseSharedInboxAccess,
  sharedInboxAccessToConfigPatch,
  type SharedInboxAccessMode,
} from "@/lib/email/shared-inbox-access";
import { isEmailSendConfigured } from "@/lib/email/is-email-send-configured";
import {
  emailIntegrationConfigToPublic,
  fetchRestaurantEmailIntegration,
  fetchRestaurantEmailSmtpConfig,
  upsertRestaurantEmailIntegration,
} from "@/lib/supabase/restaurant-email-integration-db";
import { syncInboxHistoryOnConnect } from "@/lib/contacts/sync-inbox-history-on-connect-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { EmailIntegrationResponse } from "@/lib/types/restaurant-integration";

function resolveSharedInboxPatch(params: {
  existingConfig: Record<string, unknown> | undefined;
  sharedInboxAccess?: SharedInboxAccessMode;
  sharedInboxUserIds?: string[];
}): Record<string, unknown> {
  const current = parseSharedInboxAccess(params.existingConfig ?? {});
  const access: SharedInboxAccessMode =
    params.sharedInboxAccess === "restricted" ||
    params.sharedInboxAccess === "all_staff"
      ? params.sharedInboxAccess
      : current.access;
  const userIds = Array.isArray(params.sharedInboxUserIds)
    ? params.sharedInboxUserIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      )
    : current.userIds;
  return sharedInboxAccessToConfigPatch({ access, userIds });
}

export const dynamic = "force-dynamic";

async function assertCanManageEmail(restaurantId: string) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, sb: null };

  const platform = await assertPlatformEmailEnabled(sb);
  if (!platform.ok) return { ok: false as const, status: 403, sb: null };

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.email",
  });
  if (!allowed) return { ok: false as const, status: 403, sb: null };
  return { ok: true as const, status: 200, sb };
}

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertCanManageEmail(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const row = await fetchRestaurantEmailIntegration(auth.sb, restaurantId);
  const sendConfigured = isEmailSendConfigured();
  const [gmailOAuthConfigured, outlookOAuthConfigured] = await Promise.all([
    getGmailOAuthPlatformConfigAdmin().then(Boolean),
    getOutlookOAuthPlatformConfigAdmin().then(Boolean),
  ]);
  const status = row?.status ?? "default";
  const pub = row?.config ?? {};
  const shared = parseSharedInboxAccess(pub);

  const body: EmailIntegrationResponse = {
    configured: true,
    emailSendConfigured: sendConfigured,
    platformEmailEnabled: true,
    gmailOAuthConfigured,
    outlookOAuthConfigured,
    status,
    fromEmail: pub.email ?? pub.from_email ?? null,
    fromName: pub.from_name ?? null,
    smtpHost: pub.smtp_host ?? null,
    smtpPort: pub.smtp_port != null ? String(pub.smtp_port) : null,
    imapHost: pub.imap_host ?? null,
    imapPort: pub.imap_port != null ? String(pub.imap_port) : null,
    passwordConfigured: Boolean(pub.passwordConfigured),
    grantedScopes: Array.isArray(pub.granted_scopes) ? pub.granted_scopes : [],
    sharedInboxAccess: shared.access,
    sharedInboxUserIds: shared.userIds,
    defaultFromEmail: GWADA_DEFAULT_FROM_EMAIL,
    defaultFromName: GWADA_DEFAULT_FROM_NAME,
    message: sendConfigured
      ? undefined
      : "SUPABASE_SERVICE_ROLE_KEY fehlt — E-Mail-Versand nur serverseitig möglich.",
  };

  return Response.json(body);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    useCustom?: boolean;
    mailboxMode?: "smtp" | "gmail" | "outlook";
    email?: string;
    password?: string;
    smtpHost?: string;
    smtpPort?: string;
    imapHost?: string;
    imapPort?: string;
    fromName?: string;
    sharedInboxAccess?: SharedInboxAccessMode;
    sharedInboxUserIds?: string[];
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertCanManageEmail(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const useCustom = body.useCustom === true;
  const existing = await fetchRestaurantEmailSmtpConfig(auth.sb, restaurantId);
  const sharedPatch = resolveSharedInboxPatch({
    existingConfig: existing?.config,
    sharedInboxAccess: body.sharedInboxAccess,
    sharedInboxUserIds: body.sharedInboxUserIds,
  });

  if (useCustom) {
    const billing = await assertBillingFeature(
      restaurantId,
      "integrations.email",
    );
    if (!billing.ok) {
      return Response.json(
        { error: billing.error, feature: billing.feature },
        { status: billing.status },
      );
    }
  }

  if (!useCustom) {
    const { error } = await upsertRestaurantEmailIntegration(
      auth.sb,
      restaurantId,
      {
        status: "default",
        config: { ...sharedPatch },
        last_error: null,
      },
    );
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ ok: true, status: "default" });
  }

  if (body.mailboxMode === "gmail" || body.mailboxMode === "outlook") {
    const expectedStatus = body.mailboxMode;
    if (existing?.status !== expectedStatus) {
      return Response.json(
        {
          error:
            expectedStatus === "gmail"
              ? "Bitte zuerst mit Google verbinden."
              : "Bitte zuerst mit Microsoft verbinden.",
        },
        { status: 400 },
      );
    }
    const nextConfig = {
      ...existing.config,
      from_name: body.fromName?.trim() || existing.config.from_name,
      ...sharedPatch,
    };
    const { error } = await upsertRestaurantEmailIntegration(
      auth.sb,
      restaurantId,
      {
        status: expectedStatus,
        config: nextConfig,
        last_error: null,
      },
    );
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({
      ok: true,
      status: expectedStatus,
      config: emailIntegrationConfigToPublic(nextConfig),
    });
  }

  const wasMailbox = isRestaurantEmailMailboxStatus(existing?.status);
  const merged = {
    email: body.email?.trim(),
    password: mergeSmtpPassword(body.password, existing?.config ?? {}),
    smtp_host: body.smtpHost?.trim(),
    smtp_port: body.smtpPort?.trim(),
    imap_host: body.imapHost?.trim(),
    imap_port: body.imapPort?.trim(),
    from_name: body.fromName?.trim(),
    ...sharedPatch,
  };

  const validationError = validateSmtpConfigForSave(merged, {
    requirePassword:
      !existing?.config.password?.length && !body.password?.trim(),
  });
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { error } = await upsertRestaurantEmailIntegration(
    auth.sb,
    restaurantId,
    {
      status: "custom",
      config: merged,
      last_error: null,
    },
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  if (!wasMailbox) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      void syncInboxHistoryOnConnect(admin, {
        restaurantId,
        email: true,
      }).catch((e) => {
        console.warn("[contact-inbox] history-on-connect email", e);
      });
    }
  }

  return Response.json({
    ok: true,
    status: "custom",
    config: emailIntegrationConfigToPublic(merged),
  });
}
