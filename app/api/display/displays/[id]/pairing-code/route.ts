import { NextResponse } from "next/server";
import { generatePairingCode } from "@/lib/display/display-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: display } = await sb
    .from("restaurant_displays")
    .select("id, restaurant_id, name")
    .eq("id", id)
    .maybeSingle();

  if (!display) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: display.restaurant_id,
    p_permission: "display.manage",
  });
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("slug")
    .eq("id", display.restaurant_id)
    .maybeSingle();

  await sb.from("restaurant_display_pairing_codes").delete().eq("display_id", id);

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await sb.from("restaurant_display_pairing_codes").insert({
    display_id: id,
    code,
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const pairUrl = `${origin}/display/pair?code=${encodeURIComponent(code)}`;

  return NextResponse.json({
    code,
    expires_at: expiresAt,
    pair_url: pairUrl,
    restaurant_slug: restaurant?.slug ?? null,
  });
}
