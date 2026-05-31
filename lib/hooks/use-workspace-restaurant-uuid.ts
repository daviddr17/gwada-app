"use client";

import { useCallback, useEffect, useState } from "react";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  getWorkspaceRestaurantId,
  peekCachedWorkspaceRestaurantId,
  supabasePublicEnvConfigured,
} from "@/lib/supabase/workspace-persistence";

export function useWorkspaceRestaurantUuid() {
  const supabaseEnvOk = supabasePublicEnvConfigured();
  const [restaurantId, setRestaurantId] = useState<string | null>(() =>
    peekCachedWorkspaceRestaurantId(),
  );
  const [ready, setReady] = useState(
    () => !supabaseEnvOk || peekCachedWorkspaceRestaurantId() !== null,
  );

  const refresh = useCallback(async () => {
    if (!supabaseEnvOk) {
      setRestaurantId(null);
      setReady(true);
      return;
    }
    const id = await getWorkspaceRestaurantId();
    setRestaurantId(id && isUuidRestaurantId(id) ? id : null);
    setReady(true);
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

  return { restaurantId, supabaseEnvOk, ready, refresh };
}
