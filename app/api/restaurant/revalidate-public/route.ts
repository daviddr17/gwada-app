import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    restaurantId?: string;
  };

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let restaurantId = body.restaurantId?.trim() ?? "";
  if (!restaurantId && body.slug?.trim()) {
    const slug = normalizeRestaurantSlugInput(body.slug);
    const { data } = await sb
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    restaurantId = typeof data?.id === "string" ? data.id : "";
  }

  if (!restaurantId) {
    return NextResponse.json({ error: "missing_restaurant" }, { status: 400 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "settings.restaurant",
  });
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: row } = await sb
    .from("restaurants")
    .select("slug")
    .eq("id", restaurantId)
    .maybeSingle();
  const slug =
    typeof row?.slug === "string" ? normalizeRestaurantSlugInput(row.slug) : null;
  if (!slug) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  revalidatePath(`/${slug}`);
  return NextResponse.json({ ok: true, slug });
}
