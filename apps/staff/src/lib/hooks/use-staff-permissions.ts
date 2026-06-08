import { useCallback, useEffect, useState } from "react";
import { getStaffSupabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth-store";

export function useStaffPermissions() {
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const session = useAuthStore((s) => s.session);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!restaurantId || !session?.user) {
      setPermissions(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    const sb = getStaffSupabase();
    const [{ data, error }, { data: employee }] = await Promise.all([
      sb.rpc("auth_user_restaurant_permission_keys", {
        p_restaurant_id: restaurantId,
      }),
      sb
        .from("restaurant_employees")
        .select("role, restaurant_positions(slug)")
        .eq("restaurant_id", restaurantId)
        .eq("profile_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    const keys = new Set<string>((data as string[] | null) ?? []);
    if (!error) {
      const positionSlug = (
        employee as { restaurant_positions?: { slug?: string } | null } | null
      )?.restaurant_positions?.slug;
      const employeeRole = (employee as { role?: string } | null)?.role;
      if (positionSlug === "owner" || employeeRole === "owner") {
        keys.add("pos.kasse.manage");
        keys.add("pos.kasse.export");
      }
    }

    setPermissions(keys);
    setLoading(false);
  }, [restaurantId, session?.user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const has = useCallback(
    (key: string) => permissions.has(key),
    [permissions],
  );

  return { permissions, has, loading, reload };
}
