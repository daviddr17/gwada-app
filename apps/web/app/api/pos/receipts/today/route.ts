import { listPosTodayReceipts } from "@/lib/pos/pos-void-cash-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const receipts = await listPosTodayReceipts(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ receipts });
}
