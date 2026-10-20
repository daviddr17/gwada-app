import { NextResponse } from "next/server";
import { resolveRestaurantBySlug } from "@/lib/ordering/create-guest-order-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Staff PIN unlock for locked kiosk shell (iPad table + Android counter).
 * Uses the same display PIN as restaurant staff — no device pairing required.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const restaurant = await resolveRestaurantBySlug(slug);
  if (!restaurant.ok) {
    return NextResponse.json(
      { error: restaurant.error },
      { status: restaurant.status },
    );
  }

  let body: { pin?: string };
  try {
    body = (await request.json()) as { pin?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const pin = body.pin?.trim() ?? "";
  if (!/^[0-9]{4}$/.test(pin)) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 503 },
    );
  }

  const { data: staffId } = await admin.rpc(
    "resolve_restaurant_staff_by_display_pin",
    {
      p_restaurant_id: restaurant.restaurantId,
      p_pin: pin,
    },
  );

  if (!staffId) {
    return NextResponse.json({ error: "wrong_pin" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, unlocked: true });
}
