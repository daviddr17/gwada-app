import {
  listRestaurantBillingInvoices,
  refreshRestaurantBillingInvoicesFromStripe,
} from "@/lib/billing/restaurant-invoices";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim();
  if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "billing.manage");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await refreshRestaurantBillingInvoicesFromStripe(restaurantId);
  } catch (err) {
    console.warn(
      "refreshRestaurantBillingInvoicesFromStripe",
      err instanceof Error ? err.message : err,
    );
  }

  const invoices = await listRestaurantBillingInvoices(restaurantId);
  return Response.json({ invoices });
}
