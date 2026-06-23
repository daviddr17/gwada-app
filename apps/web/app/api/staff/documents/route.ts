import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import {
  listMyStaffDocuments,
  listStaffDocumentsForEmployee,
} from "@/lib/staff/staff-documents-access-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const staffId = url.searchParams.get("staffId")?.trim() ?? "";
  const scope = url.searchParams.get("scope")?.trim() ?? "employee";

  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (scope === "my") {
    const result = await listMyStaffDocuments({
      restaurantId,
      userId: auth.userId,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({
      staffId: result.staffId,
      documents: result.rows,
    });
  }

  if (!isUuidRestaurantId(staffId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await listStaffDocumentsForEmployee({
    restaurantId,
    staffId,
    userId: auth.userId,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ documents: result.rows });
}
