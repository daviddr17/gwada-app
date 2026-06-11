import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import {
  mergeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences";
import { loadNotificationChannelsInfo } from "@/lib/notifications/notification-channels-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadNotificationPreferences,
  upsertNotificationPreferences,
} from "@/lib/supabase/user-restaurant-notification-preferences-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const [preferences, channels] = await Promise.all([
    loadNotificationPreferences(sb, {
      profileId: auth.userId,
      restaurantId: auth.restaurantId,
    }),
    loadNotificationChannelsInfo(admin, auth.restaurantId),
  ]);

  return Response.json({ data: { preferences, channels } });
}

export async function PUT(req: Request) {
  let body: {
    restaurantId?: string;
    preferences?: Partial<NotificationPreferences> & Record<string, unknown>;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const auth = await authorizeDashboardRestaurant(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!body.preferences || typeof body.preferences !== "object") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const raw = body.preferences;
  const merged = mergeNotificationPreferences({
    channel_whatsapp_enabled: raw.channelWhatsappEnabled,
    channel_email_enabled: raw.channelEmailEnabled,
    in_app_modules: raw.inAppModules as Record<string, unknown>,
    push_whatsapp_modules: raw.pushWhatsappModules as Record<string, unknown>,
    push_email_modules: raw.pushEmailModules as Record<string, unknown>,
  });

  const sb = await createSupabaseServerClient();
  const result = await upsertNotificationPreferences(sb, {
    profileId: auth.userId,
    restaurantId: auth.restaurantId,
    preferences: merged,
  });

  if (!result.ok) {
    return Response.json({ error: result.error ?? "failed" }, { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  const channels = admin
    ? await loadNotificationChannelsInfo(admin, auth.restaurantId)
    : {
        whatsappConnected: false,
        restaurantEmailConfigured: false,
        platformEmailFallbackAvailable: true,
      };

  return Response.json({
    data: {
      preferences: merged,
      channels,
    },
  });
}
