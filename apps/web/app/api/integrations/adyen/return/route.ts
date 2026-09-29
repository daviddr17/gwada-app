import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { authorizeAdyenRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import {
  fetchRestaurantAdyenConnectionAdmin,
  saveRestaurantAdyenConnectionAdmin,
} from "@/lib/supabase/restaurant-adyen-connection-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeAdyenRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return redirectToSettingsIntegrations(req, {
      provider: "adyen",
      result: "error",
      message: "Bitte erneut anmelden und Adyen noch einmal verbinden.",
    });
  }

  const existing = await fetchRestaurantAdyenConnectionAdmin(auth.ctx.restaurantId);
  if (existing.error || !existing.row?.balance_account_id) {
    return redirectToSettingsIntegrations(req, {
      provider: "adyen",
      result: "error",
      message: "Das Adyen-Konto konnte nicht übernommen werden.",
    });
  }

  const saved = await saveRestaurantAdyenConnectionAdmin({
    restaurantId: auth.ctx.restaurantId,
    status: "connected",
    env: existing.row.env === "live" ? "live" : "test",
    legalName: existing.row.legal_name,
    legalEntityId: existing.row.legal_entity_id,
    accountHolderId: existing.row.account_holder_id,
    balanceAccountId: existing.row.balance_account_id,
    connectedAt: new Date().toISOString(),
  });
  if (saved.error) {
    return redirectToSettingsIntegrations(req, {
      provider: "adyen",
      result: "error",
      message: saved.error,
    });
  }

  return redirectToSettingsIntegrations(req, {
    provider: "adyen",
    result: "connected",
  });
}
