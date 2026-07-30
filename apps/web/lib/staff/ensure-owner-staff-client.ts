import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const ensuredRestaurantIds = new Set<string>();

/**
 * Stellt sicher, dass aktive Inhaber auch als restaurant_staff existieren.
 * Bevorzugt die DB-RPC; fällt bei fehlender Migration auf Client-Insert zurück.
 * Pro Restaurant höchstens einmal pro Session (außer force).
 */
export async function ensureRestaurantOwnerStaffClient(
  restaurantId: string,
  options?: { force?: boolean },
): Promise<{ createdOrLinked: boolean; error: string | null }> {
  if (!restaurantId) return { createdOrLinked: false, error: null };
  if (!options?.force && ensuredRestaurantIds.has(restaurantId)) {
    return { createdOrLinked: false, error: null };
  }

  const sb = createSupabaseBrowserClient();
  const { error: rpcErr } = await sb.rpc("ensure_restaurant_owner_staff", {
    p_restaurant_id: restaurantId,
  });
  if (!rpcErr) {
    ensuredRestaurantIds.add(restaurantId);
    return { createdOrLinked: true, error: null };
  }

  // RPC fehlt oder fehlgeschlagen → Client-Fallback für sichtbare Owner-Zeilen
  const { data: owners, error: ownersErr } = await sb
    .from("restaurant_employees")
    .select("id, profile_id, staff_id, position_id")
    .eq("restaurant_id", restaurantId)
    .eq("role", "owner")
    .eq("is_active", true);

  if (ownersErr) {
    return { createdOrLinked: false, error: ownersErr.message };
  }

  const missing = (owners ?? []).filter((o) => !o.staff_id);
  if (missing.length === 0) {
    ensuredRestaurantIds.add(restaurantId);
    return { createdOrLinked: false, error: null };
  }

  const { data: ownerPos } = await sb
    .from("restaurant_positions")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("slug", "owner")
    .maybeSingle();

  let linkedAny = false;

  for (const emp of missing) {
    if (!emp.profile_id) continue;

    const { data: existingStaff } = await sb
      .from("restaurant_staff")
      .select("id, employee_id")
      .eq("restaurant_id", restaurantId)
      .eq("profile_id", emp.profile_id)
      .maybeSingle();

    let staffId = existingStaff?.id as string | undefined;

    if (!staffId) {
      const { data: profile } = await sb
        .from("profiles")
        .select("given_name, family_name, display_name, phone, notification_email")
        .eq("id", emp.profile_id)
        .maybeSingle();

      const display = profile?.display_name?.trim() || "";
      let given = profile?.given_name?.trim() || "";
      let family = profile?.family_name?.trim() || "";
      if (!given && display) {
        const parts = display.split(/\s+/);
        given = parts[0] ?? "Inhaber";
        if (!family && parts.length > 1) family = parts.slice(1).join(" ");
      }
      if (!given) given = "Inhaber";
      if (!family) family = "—";

      const { data: inserted, error: insErr } = await sb
        .from("restaurant_staff")
        .insert({
          restaurant_id: restaurantId,
          profile_id: emp.profile_id,
          employee_id: emp.id,
          restaurant_position_id: ownerPos?.id ?? emp.position_id ?? null,
          given_name: given,
          family_name: family,
          email: profile?.notification_email?.trim() || null,
          phone: profile?.phone?.trim() || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (insErr || !inserted?.id) {
        console.warn("[gwada] ensure owner staff insert", insErr);
        continue;
      }
      staffId = inserted.id as string;
    } else if (!existingStaff?.employee_id) {
      await sb
        .from("restaurant_staff")
        .update({
          employee_id: emp.id,
          restaurant_position_id:
            ownerPos?.id ?? emp.position_id ?? undefined,
          is_active: true,
        })
        .eq("id", staffId);
    }

    const { error: linkErr } = await sb
      .from("restaurant_employees")
      .update({
        staff_id: staffId,
        position_id: emp.position_id ?? ownerPos?.id ?? null,
      })
      .eq("id", emp.id);

    if (linkErr) {
      console.warn("[gwada] ensure owner staff link", linkErr);
      continue;
    }
    linkedAny = true;
  }

  ensuredRestaurantIds.add(restaurantId);
  return { createdOrLinked: linkedAny, error: null };
}
