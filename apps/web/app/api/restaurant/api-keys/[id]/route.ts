import { NextResponse } from "next/server";
import { revokeRestaurantApiKey } from "@/lib/api/restaurant-api-keys-server";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const restaurantId = new URL(request.url).searchParams.get("restaurantId")?.trim();
  if (!restaurantId || !id) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "settings.api");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await revokeRestaurantApiKey(restaurantId, id);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
