"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT_HEX,
} from "@/lib/theme/constants";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { applyAccentToDocument, normalizeHex } from "@/lib/theme/color-utils";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  fetchRestaurantBrandAccentHex,
  updateRestaurantBrandAccentHex,
} from "@/lib/supabase/restaurant-brand-accent";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  getWorkspaceRestaurantId,
  loadWorkspaceJson,
  persistWorkspaceState,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

type AccentColorContextValue = {
  accentHex: string;
  setAccentHex: (hex: string) => void;
  isReady: boolean;
};

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

function parseAccentFromWorkspaceRemote(remote: unknown): string | null {
  let candidate = "";
  if (typeof remote === "string") {
    candidate = remote;
  } else if (
    remote &&
    typeof remote === "object" &&
    !Array.isArray(remote) &&
    typeof (remote as { value?: unknown }).value === "string"
  ) {
    candidate = (remote as { value: string }).value;
  }
  return normalizeHex(candidate);
}

/** Liest Spalte `restaurants.brand_accent_hex`, sonst Legacy `restaurant_app_state`, sonst localStorage (hybrid). */
async function loadRestaurantAccentResolved(
  supabaseOnly: boolean,
): Promise<string> {
  if (workspacePersistenceConfigured()) {
    const rid = await getWorkspaceRestaurantId();
    if (rid) {
      const fromColumn = await fetchRestaurantBrandAccentHex(rid);
      if (fromColumn) return fromColumn;
    }
    const remote = await loadWorkspaceJson(ACCENT_STORAGE_KEY);
    const fromRemote = parseAccentFromWorkspaceRemote(remote);
    if (fromRemote) return fromRemote;
  }
  if (!supabaseOnly && typeof localStorage !== "undefined") {
    const fromLs = normalizeHex(localStorage.getItem(ACCENT_STORAGE_KEY) ?? "");
    if (fromLs) return fromLs;
  }
  return DEFAULT_ACCENT_HEX;
}

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [accentHex, setAccentHexState] = useState(DEFAULT_ACCENT_HEX);
  const [isReady, setIsReady] = useState(false);
  const accentHexRef = useRef(accentHex);
  accentHexRef.current = accentHex;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initial = await loadRestaurantAccentResolved(supabaseOnly);
      if (cancelled) return;
      if (supabaseOnly) {
        setAccentHexState(initial);
        applyAccentToDocument(initial);
        setIsReady(true);
        return;
      }
      requestAnimationFrame(() => {
        if (cancelled) return;
        setAccentHexState(initial);
        applyAccentToDocument(initial);
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(ACCENT_STORAGE_KEY, initial);
          }
        } catch {
          /* ignore */
        }
        setIsReady(true);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly]);

  useEffect(() => {
    const onWorkspaceRestaurant = () => {
      void (async () => {
        const next = await loadRestaurantAccentResolved(supabaseOnly);
        setAccentHexState(next);
        applyAccentToDocument(next);
        if (!supabaseOnly && typeof localStorage !== "undefined") {
          try {
            localStorage.setItem(ACCENT_STORAGE_KEY, next);
          } catch {
            /* ignore */
          }
        }
      })();
    };
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onWorkspaceRestaurant,
    );
    return () =>
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onWorkspaceRestaurant,
      );
  }, [supabaseOnly]);

  const setAccentHex = useCallback(
    (hex: string) => {
      const normalized = normalizeHex(hex);
      if (!normalized) {
        toast.error("Ungültige Farbe.");
        return;
      }
      if (normalized === accentHexRef.current) {
        return;
      }
      const prev = accentHexRef.current;
      setAccentHexState(normalized);
      applyAccentToDocument(normalized);

      void (async () => {
        const wp = workspacePersistenceConfigured();
        const rid = wp ? await getWorkspaceRestaurantId() : null;
        let ok = false;
        if (rid) {
          ok = await updateRestaurantBrandAccentHex(rid, normalized);
        } else {
          ok = await persistWorkspaceState(ACCENT_STORAGE_KEY, normalized);
        }
        if (!ok) {
          setAccentHexState(prev);
          applyAccentToDocument(prev);
          failSave();
          return;
        }
        if (!supabaseOnly) {
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(ACCENT_STORAGE_KEY, normalized);
            }
          } catch {
            /* ignore */
          }
        }
        toast.success("Akzentfarbe gespeichert");
      })();
    },
    [failSave, supabaseOnly],
  );

  const value = useMemo(
    () => ({ accentHex, setAccentHex, isReady }),
    [accentHex, setAccentHex, isReady],
  );

  return (
    <AccentColorContext.Provider value={value}>
      {children}
    </AccentColorContext.Provider>
  );
}

export function useAccentColor() {
  const ctx = useContext(AccentColorContext);
  if (!ctx) {
    throw new Error("useAccentColor must be used within AccentColorProvider");
  }
  return ctx;
}
