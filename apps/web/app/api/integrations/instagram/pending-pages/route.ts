import { loadMetaOAuthPendingFromRequest } from "@/lib/integrations/oauth-pending-load";
import { metaPagesEligibleForInstagram } from "@/lib/integrations/meta-oauth-shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pending = await loadMetaOAuthPendingFromRequest(req, "instagram");
  if (!pending) {
    return Response.json({ error: "pending_not_found" }, { status: 404 });
  }

  const pages = metaPagesEligibleForInstagram(pending.pages).map((p) => {
    const ig = p.instagram_business_account;
    const secondaryLabel = ig?.username ? `@${ig.username}` : null;
    return {
      id: p.id,
      name: p.name,
      secondaryLabel,
    };
  });

  return Response.json({
    provider: "instagram" as const,
    restaurantId: pending.restaurantId,
    pages,
    preselectedPageId: pages.length === 1 ? pages[0]!.id : null,
  });
}
