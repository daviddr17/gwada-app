import { generateRegisterReportPdfUrl } from "@/lib/pos/generate-register-report";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");

  const auth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "pos.kasse.export",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await generateRegisterReportPdfUrl({
    restaurantId: auth.auth.restaurantId,
    reportType: "X",
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    sessionId: result.sessionId,
    pdfUrl: result.pdfUrl,
  });
}
