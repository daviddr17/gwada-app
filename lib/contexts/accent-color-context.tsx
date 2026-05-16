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
import { applyAccentToDocument, normalizeHex } from "@/lib/theme/color-utils";
import { toastStorageError } from "@/lib/persist-notify";

type AccentColorContextValue = {
  accentHex: string;
  setAccentHex: (hex: string) => void;
  isReady: boolean;
};

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [accentHex, setAccentHexState] = useState(DEFAULT_ACCENT_HEX);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    const initial = normalizeHex(stored ?? "") ?? DEFAULT_ACCENT_HEX;
    const frame = requestAnimationFrame(() => {
      setAccentHexState(initial);
      applyAccentToDocument(initial);
      setIsReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const setAccentHex = useCallback((hex: string) => {
    const normalized = normalizeHex(hex);
    if (!normalized) {
      toast.error("Ungültige Farbe.");
      return;
    }
    try {
      setAccentHexState(normalized);
      applyAccentToDocument(normalized);
      localStorage.setItem(ACCENT_STORAGE_KEY, normalized);
      toast.success("Akzentfarbe gespeichert");
    } catch (e) {
      console.error(e);
      toastStorageError();
    }
  }, []);

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
