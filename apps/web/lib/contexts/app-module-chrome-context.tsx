"use client";

import * as React from "react";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

export type AppModuleSubnav = {
  items: ModuleSubnavItem[];
  ariaLabel: string;
};

export type AppModuleChromeState = {
  title: string;
  subnav: AppModuleSubnav | null;
  /** Zweite Chip-Leiste unter der Modul-Subnav (z. B. POS → Einstellungen). */
  secondarySubnav: AppModuleSubnav | null;
};

const EMPTY: AppModuleChromeState = {
  title: "",
  subnav: null,
  secondarySubnav: null,
};

type Ctx = {
  chrome: AppModuleChromeState;
  setChrome: React.Dispatch<React.SetStateAction<AppModuleChromeState>>;
};

const AppModuleChromeContext = React.createContext<Ctx | null>(null);

export function AppModuleChromeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chrome, setChrome] = React.useState<AppModuleChromeState>(EMPTY);

  const value = React.useMemo(() => ({ chrome, setChrome }), [chrome]);

  return (
    <AppModuleChromeContext.Provider value={value}>
      {children}
    </AppModuleChromeContext.Provider>
  );
}

export function useAppModuleChrome() {
  const ctx = React.useContext(AppModuleChromeContext);
  if (!ctx) {
    throw new Error(
      "useAppModuleChrome must be used within AppModuleChromeProvider",
    );
  }
  return ctx;
}

export function useAppModuleChromeOptional(): AppModuleChromeState | null {
  const ctx = React.useContext(AppModuleChromeContext);
  return ctx?.chrome ?? null;
}

/** Registriert Titel + Chip-Untermenü für die App-Kopfzeile (cleanup beim Unmount). */
export function RegisterModuleChrome({
  title,
  subnavAriaLabel,
  subnavItems,
}: {
  title: string;
  subnavAriaLabel: string | null;
  subnavItems: readonly ModuleSubnavItem[] | null;
}) {
  const { setChrome } = useAppModuleChrome();

  React.useLayoutEffect(() => {
    setChrome((prev) => ({
      title,
      subnav:
        subnavItems && subnavItems.length > 0 && subnavAriaLabel
          ? { items: [...subnavItems], ariaLabel: subnavAriaLabel }
          : null,
      // Nested layouts may own the secondary strip — don't wipe it here.
      secondarySubnav: prev.secondarySubnav,
    }));
    return () => setChrome(EMPTY);
  }, [title, subnavAriaLabel, subnavItems, setChrome]);

  return null;
}

/**
 * Zweite Chip-Leiste direkt unter der Modul-Subnav (gleicher Chrome, nicht scrollend).
 * Für Nested-Layouts wie POS → Einstellungen.
 */
export function RegisterModuleSecondarySubnav({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: readonly ModuleSubnavItem[];
}) {
  const { setChrome } = useAppModuleChrome();

  React.useLayoutEffect(() => {
    setChrome((prev) => ({
      ...prev,
      secondarySubnav:
        items.length > 0 ? { items: [...items], ariaLabel } : null,
    }));
    return () => {
      setChrome((prev) => ({ ...prev, secondarySubnav: null }));
    };
  }, [ariaLabel, items, setChrome]);

  return null;
}
