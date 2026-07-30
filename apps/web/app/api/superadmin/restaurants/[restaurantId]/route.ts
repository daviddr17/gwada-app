import { NextResponse } from "next/server";
import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { loadSuperadminRestaurantProfile } from "@/lib/superadmin/load-superadmin-entity-profiles";

type RouteContext = { params: Promise<{ restaurantId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { restaurantId } = await context.params;
  const result = await loadSuperadminRestaurantProfile(restaurantId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.detail);
}
