"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  getWorkspaceRestaurantId,
  peekCachedWorkspaceRestaurantId,
  supabasePublicEnvConfigured,
} from "@/lib/supabase/workspace-persistence";

export type WorkspaceRestaurantValue = {
  restaurantId: string | null;
  supabaseEnvOk: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
};

const WorkspaceRestaurantContext =
  createContext<WorkspaceRestaurantValue | null>(null);

function readCachedRestaurantId(): string | null {
  if (typeof window === "undefined") return null;
  const cached = peekCachedWorkspaceRestaurantId();
  return cached && isUuidRestaurantId(cached) ? cached : null;
}

/** Workspace-Restaurant einmal pro App-Layout — Modulwechsel ohne erneutes getSession/DB. */
export function WorkspaceRestaurantProvider({ children }: { children: ReactNode }) {
  const supabaseEnvOk = supabasePublicEnvConfigured();
  const [restaurantId, setRestaurantId] = useState<string | null>(
    readCachedRestaurantId,
  );
  const [ready, setReady] = useState(false);

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
    const cached = peekCachedWorkspaceRestaurantId();
    if (cached) {
      setRestaurantId(cached);
    }
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

  const value = useMemo<WorkspaceRestaurantValue>(
    () => ({
      restaurantId,
      supabaseEnvOk,
      ready,
      refresh,
    }),
    [restaurantId, supabaseEnvOk, ready, refresh],
  );

  return (
    <WorkspaceRestaurantContext.Provider value={value}>
      {children}
    </WorkspaceRestaurantContext.Provider>
  );
}

export function useWorkspaceRestaurantContext(): WorkspaceRestaurantValue {
  const ctx = useContext(WorkspaceRestaurantContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceRestaurantContext erfordert WorkspaceRestaurantProvider.",
    );
  }
  return ctx;
}
