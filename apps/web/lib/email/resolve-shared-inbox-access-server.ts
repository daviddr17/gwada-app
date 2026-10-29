import "server-only";

import {
  canAccessSharedEmailInbox,
  parseSharedInboxAccess,
  type SharedInboxAccessConfig,
} from "@/lib/email/shared-inbox-access";
import { fetchRestaurantEmailSmtpConfig } from "@/lib/supabase/restaurant-email-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadSharedInboxAccessConfig(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<SharedInboxAccessConfig> {
  const row = await fetchRestaurantEmailSmtpConfig(admin, restaurantId);
  return parseSharedInboxAccess(row?.config ?? {});
}

export async function resolveCanAccessSharedEmailInbox(params: {
  admin: SupabaseClient;
  restaurantId: string;
  userId: string;
  /** Caller already knows integrations.email — skip RPC. */
  canManageEmail?: boolean;
  userClient?: SupabaseClient;
}): Promise<{
  access: SharedInboxAccessConfig;
  canAccessShared: boolean;
  canManageEmail: boolean;
}> {
  const access = await loadSharedInboxAccessConfig(
    params.admin,
    params.restaurantId,
  );

  let canManageEmail = params.canManageEmail === true;
  if (params.canManageEmail === undefined && params.userClient) {
    const { data: allowed } = await params.userClient.rpc(
      "auth_has_restaurant_permission",
      {
        p_restaurant_id: params.restaurantId,
        p_permission: "integrations.email",
      },
    );
    canManageEmail = Boolean(allowed);
  }

  return {
    access,
    canManageEmail,
    canAccessShared: canAccessSharedEmailInbox({
      userId: params.userId,
      canManageEmail,
      access,
    }),
  };
}
