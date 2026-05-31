import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { canSendStaffInviteEmail } from "@/lib/staff/staff-invite-send-server";
import {
  assertPlatformEmailEnabled,
  assertPlatformFacebookEnabled,
  assertPlatformWhatsappEnabled,
} from "@/lib/integrations/platform-messaging-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantFacebookIntegration } from "@/lib/supabase/restaurant-facebook-integration-db";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const waPlatform = await assertPlatformWhatsappEnabled(auth.supabase);
  const emPlatform = await assertPlatformEmailEnabled(auth.supabase);
  const fbPlatform = await assertPlatformFacebookEnabled(auth.supabase);

  let whatsappConnected = false;
  if (waPlatform.ok) {
    const admin = createSupabaseAdminClient();
    const config = await getWahaServerConfigAdmin();
    if (admin && config) {
      const session = wahaSessionNameForRestaurant(auth.restaurantId);
      const live = await wahaGetSession(config, session);
      whatsappConnected = live.ok && live.data?.status === "WORKING";
    }
  }

  let emailConnected = false;
  if (emPlatform.ok) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const creds = await resolveRestaurantImapCredentials(
        admin,
        auth.restaurantId,
      );
      emailConnected = creds != null;
    }
  }

  let facebookConnected = false;
  if (fbPlatform.ok) {
    const fbRow = await fetchRestaurantFacebookIntegration(
      auth.supabase,
      auth.restaurantId,
    );
    facebookConnected = fbRow?.status === "working";
  }

  const staffInviteEmailAvailable =
    emPlatform.ok &&
    (await canSendStaffInviteEmail(auth.restaurantId, auth.supabase));

  return Response.json({
    whatsappEnabled: waPlatform.ok,
    emailEnabled: emPlatform.ok,
    facebookEnabled: fbPlatform.ok,
    whatsappConnected,
    emailConnected,
    facebookConnected,
    staffInviteEmailAvailable,
  });
}
