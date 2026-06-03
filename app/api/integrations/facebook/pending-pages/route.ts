import { loadMetaOAuthPendingFromRequest } from "@/lib/integrations/oauth-pending-load";
import { metaPagesEligibleForMessenger } from "@/lib/integrations/meta-oauth-shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pending = await loadMetaOAuthPendingFromRequest(req, "facebook");
  if (!pending) {
    return Response.json({ error: "pending_not_found" }, { status: 404 });
  }

  const pages = metaPagesEligibleForMessenger(pending.pages).map((p) => ({
    id: p.id,
    name: p.name,
    secondaryLabel: null as string | null,
  }));

  return Response.json({
    provider: "facebook" as const,
    restaurantId: pending.restaurantId,
    pages,
    preselectedPageId: pages.length === 1 ? pages[0]!.id : null,
  });
}
