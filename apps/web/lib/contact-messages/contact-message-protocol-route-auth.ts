import "server-only";

import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";

/** Posteingang lesen + Nachrichten-Protokoll-Berechtigung. */
export async function authorizeContactMessageProtocol(
  restaurantIdRaw: string | null,
): Promise<
  | {
      ok: true;
      restaurantId: string;
      userId: string;
    }
  | { ok: false; status: number; error: string }
> {
  const base = await authorizeContactMessagesRestaurant(restaurantIdRaw);
  if (!base.ok) return base;

  const protocol = await authorizeRestaurantModule(
    base.restaurantId,
    "contacts.messages.protocol",
  );
  if (!protocol.ok) {
    return { ok: false, status: protocol.status, error: protocol.error };
  }

  return {
    ok: true,
    restaurantId: base.restaurantId,
    userId: base.userId,
  };
}
