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
import {
  toastDatabaseSaveError,
  toastDatabaseUnavailable,
} from "@/lib/supabase/db-toast";
import {
  fetchRestaurantBrandAccentHex,
  updateRestaurantBrandAccentHex,
} from "@/lib/supabase/restaurant-brand-accent";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  getWorkspaceRestaurantId,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

type PersistAccentOptions = {
  /** Standard: Erfolg per Toast melden. */
  notify?: boolean;
};

type AccentColorContextValue = {
  accentHex: string;
  setAccentHex: (hex: string) => void;
  persistAccentHex: (hex: string, options?: PersistAccentOptions) => Promise<boolean>;
  isReady: boolean;
};

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

/** Liest Spalte `restaurants.brand_accent_hex`, sonst localStorage (hybrid). */
async function loadRestaurantAccentResolved(
  supabaseOnly: boolean,
): Promise<string> {
  if (workspacePersistenceConfigured()) {
    const rid = await getWorkspaceRestaurantId();
    if (rid) {
      const fromColumn = await fetchRestaurantBrandAccentHex(rid);
      if (fromColumn) return fromColumn;
    }
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

  const persistAccentHex = useCallback(
    async (hex: string, options?: PersistAccentOptions): Promise<boolean> => {
      const notify = options?.notify !== false;
      const normalized = normalizeHex(hex);
      if (!normalized) {
        if (notify) toast.error("Ungültige Farbe.");
        return false;
      }
      if (normalized === accentHexRef.current) {
        return true;
      }
      const prev = accentHexRef.current;
      setAccentHexState(normalized);
      applyAccentToDocument(normalized);

      const wp = workspacePersistenceConfigured();
      const rid = wp ? await getWorkspaceRestaurantId() : null;
      let ok = false;
      if (rid) {
        ok = await updateRestaurantBrandAccentHex(rid, normalized);
      } else if (!supabaseOnly && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(ACCENT_STORAGE_KEY, normalized);
          ok = true;
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        setAccentHexState(prev);
        applyAccentToDocument(prev);
        if (rid) {
          toastDatabaseSaveError(
            "Akzentfarbe konnte nicht in der Datenbank gespeichert werden.",
          );
        } else {
          failSave();
        }
        return false;
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
      if (notify) {
        toast.success("Akzentfarbe gespeichert");
      }
      return true;
    },
    [failSave, supabaseOnly],
  );

  const setAccentHex = useCallback(
    (hex: string) => {
      void persistAccentHex(hex);
    },
    [persistAccentHex],
  );

  const value = useMemo(
    () => ({ accentHex, setAccentHex, persistAccentHex, isReady }),
    [accentHex, setAccentHex, persistAccentHex, isReady],
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
