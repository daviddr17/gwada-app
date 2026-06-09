import {
  loadPosSessionSummary,
} from "@/lib/pos/pos-session-settlement-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const result = await loadPosSessionSummary({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    sessionId,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({ summary: result.summary });
}
