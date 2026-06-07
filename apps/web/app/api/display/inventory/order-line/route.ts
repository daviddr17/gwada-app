import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import {
  parseDisplayQuantity,
  updateDisplayOrderQuantity,
} from "@/lib/display/display-inventory-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "inventory");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: { ingredient_id?: string; quantity?: number | string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.ingredient_id) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let quantity: number | null = null;
  if (typeof body.quantity === "number") {
    quantity =
      Number.isFinite(body.quantity) && body.quantity >= 0 ? body.quantity : null;
  } else if (typeof body.quantity === "string") {
    quantity = body.quantity.trim() === "" ? 0 : parseDisplayQuantity(body.quantity);
  }

  if (quantity === null) {
    return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });
  }

  const { data: staff } = await admin
    .from("restaurant_staff")
    .select("given_name, family_name")
    .eq("id", access.staffId)
    .maybeSingle();

  const result = await updateDisplayOrderQuantity({
    restaurantId: access.restaurantId,
    ingredientId: body.ingredient_id,
    quantity,
    actor: {
      firstName: (staff?.given_name as string) ?? "",
      lastName: (staff?.family_name as string) ?? "",
    },
  });

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "no_supplier"
          ? 400
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    ingredient_id: body.ingredient_id,
    order_id: result.orderId,
    order_line_id: result.orderLineId,
    order_quantity: result.orderQuantity,
  });
}
