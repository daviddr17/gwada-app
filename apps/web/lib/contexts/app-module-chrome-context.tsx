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
  /** Custom secondary strip (z. B. Events Öffentlich/Privat ohne Soft-Nav-Links). */
  secondarySubnavContent: React.ReactNode | null;
  /** Modul-eigene Aktionen rechts im Header (z. B. Dashboard Kalender / Anordnen). */
  headerActions: React.ReactNode | null;
};

const EMPTY: AppModuleChromeState = {
  title: "",
  subnav: null,
  secondarySubnav: null,
  secondarySubnavContent: null,
  headerActions: null,
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
  headerActions = null,
}: {
  title: string;
  subnavAriaLabel: string | null;
  subnavItems: readonly ModuleSubnavItem[] | null;
  headerActions?: React.ReactNode | null;
}) {
  const { setChrome } = useAppModuleChrome();
  // Inline JSX (`headerActions={<Foo />}`) hat jedes Render neue Identity —
  // nie als Effect-Dep, sonst Maximum-update-depth. Parent soll memoizen;
  // Ref hält den aktuellen Node für den Sync unten.
  const headerActionsRef = React.useRef(headerActions);
  headerActionsRef.current = headerActions;

  React.useLayoutEffect(() => {
    setChrome((prev) => ({
      title,
      subnav:
        subnavItems && subnavItems.length > 0 && subnavAriaLabel
          ? { items: [...subnavItems], ariaLabel: subnavAriaLabel }
          : null,
      // Nested layouts may own the secondary strip — preserve only within the same module title.
      secondarySubnav: prev.title === title ? prev.secondarySubnav : null,
      secondarySubnavContent:
        prev.title === title ? prev.secondarySubnavContent : null,
      headerActions: headerActionsRef.current ?? null,
    }));
    return () => {
      // Soft-Nav: nicht blind auf EMPTY — SoftNavPendingOverlay / nächstes Modul
      // setzen den Titel oft schon optimistisch. Sonst flackert der Chrome-Titel.
      // Subnav bei gleichem Modul-Titel erhalten (Chip-Leiste nicht ausblenden).
      setChrome((prev) => {
        if (prev.title !== title) return prev;
        return {
          title,
          subnav: prev.subnav,
          secondarySubnav: prev.secondarySubnav,
          secondarySubnavContent: prev.secondarySubnavContent,
          headerActions: null,
        };
      });
    };
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
      secondarySubnavContent: null,
    }));
    return () => {
      setChrome((prev) => {
        if (prev.secondarySubnav?.ariaLabel !== ariaLabel) return prev;
        return { ...prev, secondarySubnav: null };
      });
    };
  }, [ariaLabel, items, setChrome]);

  return null;
}

/** Custom secondary chip row — kein AppNavLink / Soft-Nav (nur Query-Toggles). */
export function RegisterModuleSecondarySubnavContent({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const { setChrome } = useAppModuleChrome();

  React.useLayoutEffect(() => {
    setChrome((prev) => ({
      ...prev,
      secondarySubnav: null,
      secondarySubnavContent: (
        <nav aria-label={ariaLabel} className="min-w-0 flex-1 overflow-x-auto">
          {children}
        </nav>
      ),
    }));
    return () => {
      setChrome((prev) => {
        const nav = prev.secondarySubnavContent;
        if (!nav || typeof nav !== "object" || !("props" in nav)) return prev;
        const navAria =
          nav.props &&
          typeof nav.props === "object" &&
          "aria-label" in nav.props &&
          typeof nav.props["aria-label"] === "string"
            ? nav.props["aria-label"]
            : null;
        if (navAria !== ariaLabel) return prev;
        return { ...prev, secondarySubnavContent: null };
      });
    };
  }, [ariaLabel, children, setChrome]);

  return null;
}
