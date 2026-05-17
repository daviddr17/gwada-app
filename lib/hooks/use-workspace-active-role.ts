"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  getWorkspaceRestaurantId,
} from "@/lib/supabase/workspace-persistence";

export function useWorkspaceActiveRole() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setRestaurantId(null);
      setRole(null);
      return;
    }
    const rid = await getWorkspaceRestaurantId();
    setRestaurantId(rid);
    if (!rid) {
      setRole(null);
      return;
    }
    const { data } = await sb
      .from("restaurant_employees")
      .select("role")
      .eq("restaurant_id", rid)
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    setRole((data?.role as string | undefined) ?? null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
  }, [reload]);

  return { restaurantId, role, reload };
}
