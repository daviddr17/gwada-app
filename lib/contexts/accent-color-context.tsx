"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  loadWorkspaceJson,
  persistWorkspaceState,
} from "@/lib/supabase/workspace-persistence";

type AccentColorContextValue = {
  accentHex: string;
  setAccentHex: (hex: string) => void;
  isReady: boolean;
};

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [accentHex, setAccentHexState] = useState(DEFAULT_ACCENT_HEX);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await loadWorkspaceJson(ACCENT_STORAGE_KEY);
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
      const fromRemote = normalizeHex(candidate);
      if (supabaseOnly) {
        const initial = fromRemote ?? DEFAULT_ACCENT_HEX;
        if (cancelled) return;
        setAccentHexState(initial);
        applyAccentToDocument(initial);
        setIsReady(true);
        return;
      }
      const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
      const initial =
        fromRemote ?? normalizeHex(stored ?? "") ?? DEFAULT_ACCENT_HEX;
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        setAccentHexState(initial);
        applyAccentToDocument(initial);
        try {
          localStorage.setItem(ACCENT_STORAGE_KEY, initial);
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

  const setAccentHex = useCallback(
    (hex: string) => {
      const normalized = normalizeHex(hex);
      if (!normalized) {
        toast.error("Ungültige Farbe.");
        return;
      }
      setAccentHexState((prev) => {
        void persistWorkspaceState(ACCENT_STORAGE_KEY, normalized).then((ok) => {
          if (!ok) {
            setAccentHexState(prev);
            applyAccentToDocument(prev);
            failSave();
          } else {
            toast.success("Akzentfarbe gespeichert");
          }
        });
        applyAccentToDocument(normalized);
        return normalized;
      });
    },
    [failSave],
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
