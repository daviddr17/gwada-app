"use client";

import { useCallback, useEffect, useState } from "react";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  getWorkspaceRestaurantId,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

export function useWorkspaceRestaurantUuid() {
  const supabaseEnvOk = workspacePersistenceConfigured();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabaseEnvOk) {
      setRestaurantId(null);
      return;
    }
    const id = await getWorkspaceRestaurantId();
    setRestaurantId(id && isUuidRestaurantId(id) ? id : null);
  }, [supabaseEnvOk]);

  useEffect(() => {
    void refresh();
    const onChange = () => {
      void refresh();
    };
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onChange,
      );
    };
  }, [refresh]);

  return { restaurantId, supabaseEnvOk, refresh };
}
