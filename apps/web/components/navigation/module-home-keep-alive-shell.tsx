"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

/** Gemeinsames Keep-alive-Chrome: Titel/Subnav sobald showChrome (auch Soft-Nav-Preview). */
export function ModuleHomeKeepAliveShell({
  active,
  showChrome = active,
  title,
  subnavAriaLabel,
  subnavItems,
  children,
  fab = null,
  mainClassName,
  suspenseFallback = null,
}: {
  active: boolean;
  /** Chrome auch während Soft-Nav-Preview/Pending — Default: active. */
  showChrome?: boolean;
  title: string;
  subnavAriaLabel: string;
  subnavItems: readonly ModuleSubnavItem[];
  children: ReactNode;
  fab?: ReactNode;
  mainClassName?: string;
  suspenseFallback?: ReactNode;
}) {
  return (
    <>
      {showChrome ? (
        <RegisterModuleChrome
          title={title}
          subnavAriaLabel={subnavAriaLabel}
          subnavItems={subnavItems}
        />
      ) : null}
      <AppMain className={mainClassName}>
        <Suspense fallback={suspenseFallback}>{children}</Suspense>
      </AppMain>
      {active ? fab : null}
    </>
  );
}
