"use client";

import type { ComponentType, ReactNode } from "react";
import { AppMain } from "@/components/layout/app-main";
import {
  PosComingSoonScreen,
  PosComingSoonSkeleton,
} from "@/components/pos/pos-coming-soon-screen";
import { POS_MODULE_NAV } from "@/components/pos/pos-module-nav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { isPosLiveForViewer } from "@/lib/pos/pos-coming-soon";

export function PosComingSoonGate({
  children,
  withModuleChrome = false,
}: {
  children: ReactNode;
  /** POS-Unterseiten ohne Keep-alive: Titel/Subnav + AppMain für den Placeholder. */
  withModuleChrome?: boolean;
}) {
  const { isSuperadmin, loading } = useIsSuperadmin();
  const showSkeleton = useDeferredSkeleton(loading);

  if (loading) {
    const placeholder = showSkeleton ? (
      <PosComingSoonSkeleton />
    ) : (
      <div className="min-h-[12rem]" aria-busy="true" />
    );
    return wrapComingSoon(placeholder, withModuleChrome);
  }

  if (!isPosLiveForViewer(isSuperadmin)) {
    return wrapComingSoon(<PosComingSoonScreen />, withModuleChrome);
  }

  return children;
}

function wrapComingSoon(node: ReactNode, withModuleChrome: boolean) {
  if (!withModuleChrome) return node;
  return (
    <>
      <RegisterModuleChrome
        title="POS"
        subnavAriaLabel="POS-Bereiche"
        subnavItems={POS_MODULE_NAV}
      />
      <AppMain>{node}</AppMain>
    </>
  );
}

export function wrapPosComingSoonPage(Page: ComponentType): ComponentType {
  function Wrapped() {
    return (
      <PosComingSoonGate withModuleChrome>
        <Page />
      </PosComingSoonGate>
    );
  }
  Wrapped.displayName = `PosComingSoon(${Page.displayName ?? Page.name ?? "Page"})`;
  return Wrapped;
}
