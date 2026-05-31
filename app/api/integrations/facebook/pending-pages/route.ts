import {
  readMetaOAuthPendingFromRequest,
} from "@/lib/integrations/meta-oauth-pending";
import {
  metaPagesEligibleForInstagram,
  metaPagesEligibleForMessenger,
} from "@/lib/integrations/meta-oauth-shared";
import { authorizeFacebookRestaurantRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export type MetaOAuthPendingPageOption = {
  id: string;
  name: string;
  secondaryLabel: string | null;
};

export async function GET(req: Request) {
  const pending = readMetaOAuthPendingFromRequest(req);
  if (!pending || pending.provider !== "facebook") {
    return Response.json({ error: "pending_not_found" }, { status: 404 });
  }

  const auth = await authorizeFacebookRestaurantRoute(pending.restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const pages = metaPagesEligibleForMessenger(pending.pages).map((p) => ({
    id: p.id,
    name: p.name,
    secondaryLabel: null as string | null,
  }));

  if (pages.length === 0) {
    return Response.json({ error: "no_pages" }, { status: 400 });
  }

  return Response.json({
    provider: "facebook" as const,
    restaurantId: pending.restaurantId,
    pages,
    preselectedPageId: pages.length === 1 ? pages[0]!.id : null,
  });
}
