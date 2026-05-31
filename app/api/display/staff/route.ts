import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayDeviceFromCookies } from "@/lib/display/display-auth-server";
import { signStaffAvatarUrl } from "@/lib/display/display-storage-urls";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const deviceResult = await assertDisplayDeviceFromCookies(cookieStore);
  if (!deviceResult.ok) {
    return NextResponse.json({ error: deviceResult.error }, { status: deviceResult.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("restaurant_staff")
    .select(
      `
      id,
      given_name,
      family_name,
      display_pin_hash,
      avatar_storage_path,
      restaurant_position:restaurant_positions ( name )
    `,
    )
    .eq("restaurant_id", deviceResult.display.restaurant_id)
    .eq("is_active", true)
    .order("family_name")
    .order("given_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const staff = await Promise.all(
    (data ?? []).map(async (row) => {
      const posRaw = (row as Record<string, unknown>).restaurant_position;
      const posOne = Array.isArray(posRaw) ? posRaw[0] : posRaw;
      const positionName =
        posOne && typeof posOne === "object" && "name" in posOne
          ? String((posOne as { name: string }).name)
          : null;
      return {
        id: row.id as string,
        given_name: row.given_name as string,
        family_name: row.family_name as string,
        has_pin: Boolean(row.display_pin_hash),
        avatar_url: await signStaffAvatarUrl(
          admin,
          row.avatar_storage_path as string | null,
        ),
        position_name: positionName,
      };
    }),
  );

  return NextResponse.json({ staff });
}
