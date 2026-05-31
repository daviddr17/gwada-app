import { readMetaOAuthPendingFromRequest } from "@/lib/integrations/meta-oauth-pending";
import { metaPagesEligibleForInstagram } from "@/lib/integrations/meta-oauth-shared";
import { authorizeInstagramRestaurantRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pending = readMetaOAuthPendingFromRequest(req);
  if (!pending || pending.provider !== "instagram") {
    return Response.json({ error: "pending_not_found" }, { status: 404 });
  }

  const auth = await authorizeInstagramRestaurantRoute(pending.restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const pages = metaPagesEligibleForInstagram(pending.pages).map((p) => ({
    id: p.id,
    name: p.name,
    secondaryLabel: p.instagram_business_account?.username
      ? `@${p.instagram_business_account.username}`
      : null,
  }));

  if (pages.length === 0) {
    return Response.json({ error: "no_pages" }, { status: 400 });
  }

  return Response.json({
    provider: "instagram" as const,
    restaurantId: pending.restaurantId,
    pages,
    preselectedPageId: pages.length === 1 ? pages[0]!.id : null,
  });
}
