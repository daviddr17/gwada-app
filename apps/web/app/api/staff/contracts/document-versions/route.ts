import { fetchStaffContractDocumentVersions } from "@/lib/staff/staff-contract-versions-server";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const contractId = url.searchParams.get("contractId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(contractId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId, "read");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await fetchStaffContractDocumentVersions({
    restaurantId,
    contractId,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ versions: result.versions });
}
