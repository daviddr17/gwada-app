import { assertPlatformEmailEnabled } from "@/lib/integrations/platform-messaging-guard";
import { getGmailOAuthPlatformConfigAdmin } from "@/lib/integrations/gmail-oauth";
import { getOutlookOAuthPlatformConfigAdmin } from "@/lib/integrations/outlook-oauth";
import {
  mergeSmtpPassword,
  validateSmtpConfigForSave,
} from "@/lib/integrations/smtp-integration-config";
import { authorizePersonalEmailRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { syncUserRestaurantEmailInbox } from "@/lib/contacts/sync-user-restaurant-email-inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  fetchUserRestaurantEmailConfigAdmin,
  fetchUserRestaurantEmailIntegrationUi,
  personalEmailRowToResponse,
  upsertUserRestaurantEmailIntegration,
} from "@/lib/supabase/user-restaurant-email-integration-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizePersonalEmailRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const platform = await assertPlatformEmailEnabled(auth.ctx.supabase);
  if (!platform.ok) {
    return Response.json({ error: platform.error }, { status: 403 });
  }

  const row = await fetchUserRestaurantEmailIntegrationUi(
    auth.ctx.supabase,
    restaurantId,
  );
  const [gmailOAuthConfigured, outlookOAuthConfigured] = await Promise.all([
    getGmailOAuthPlatformConfigAdmin().then(Boolean),
    getOutlookOAuthPlatformConfigAdmin().then(Boolean),
  ]);

  return Response.json(
    personalEmailRowToResponse(row, {
      platformEmailEnabled: true,
      gmailOAuthConfigured,
      outlookOAuthConfigured,
    }),
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    action?: "disconnect" | "smtp";
    email?: string;
    password?: string;
    smtpHost?: string;
    smtpPort?: string;
    imapHost?: string;
    imapPort?: string;
    fromName?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizePersonalEmailRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  if (body.action === "disconnect") {
    const { error } = await upsertUserRestaurantEmailIntegration(admin, {
      restaurantId,
      userId: auth.ctx.userId,
      status: "disconnected",
      config: {},
    });
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ ok: true, status: "disconnected" });
  }

  const existing = await fetchUserRestaurantEmailConfigAdmin(admin, {
    restaurantId,
    userId: auth.ctx.userId,
  });
  const merged = {
    email: body.email?.trim(),
    password: mergeSmtpPassword(body.password, existing?.config ?? {}),
    smtp_host: body.smtpHost?.trim(),
    smtp_port: body.smtpPort?.trim(),
    imap_host: body.imapHost?.trim(),
    imap_port: body.imapPort?.trim(),
    from_name: body.fromName?.trim(),
  };
  const validationError = validateSmtpConfigForSave(merged, {
    requirePassword:
      !existing?.config.password?.length && !body.password?.trim(),
  });
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { error } = await upsertUserRestaurantEmailIntegration(admin, {
    restaurantId,
    userId: auth.ctx.userId,
    status: "custom",
    config: merged,
  });
  if (error) return Response.json({ error }, { status: 500 });

  void syncUserRestaurantEmailInbox(admin, {
    restaurantId,
    userId: auth.ctx.userId,
  }).catch((e) => {
    console.warn("[contact-inbox] personal smtp sync", e);
  });

  return Response.json({ ok: true, status: "custom" });
}
