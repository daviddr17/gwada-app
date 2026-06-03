import { loadGoogleOAuthPendingFromRequest } from "@/lib/integrations/oauth-pending-load";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pending = await loadGoogleOAuthPendingFromRequest(req);
  if (!pending) {
    return Response.json({ error: "pending_not_found" }, { status: 404 });
  }

  const pages = pending.locations.map((loc) => ({
    id: `${loc.accountName}::${loc.locationName}`,
    name: loc.locationTitle,
    secondaryLabel: loc.accountTitle,
  }));

  return Response.json({
    restaurantId: pending.restaurantId,
    locations: pages,
    preselectedLocationId: pages.length === 1 ? pages[0]!.id : null,
  });
}
