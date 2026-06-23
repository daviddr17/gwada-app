import { buildStaffDocumentsZipBuffer } from "@/lib/staff/staff-documents-export-server";
import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const staffId = url.searchParams.get("staffId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(staffId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await buildStaffDocumentsZipBuffer({
    restaurantId,
    staffId,
    userId: auth.userId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
