"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

/** Gemeinsames Keep-alive-Chrome: Titel/Subnav nur wenn active. */
export function ModuleHomeKeepAliveShell({
  active,
  title,
  subnavAriaLabel,
  subnavItems,
  children,
  fab = null,
  mainClassName,
}: {
  active: boolean;
  title: string;
  subnavAriaLabel: string;
  subnavItems: readonly ModuleSubnavItem[];
  children: ReactNode;
  fab?: ReactNode;
  mainClassName?: string;
}) {
  return (
    <>
      {active ? (
        <RegisterModuleChrome
          title={title}
          subnavAriaLabel={subnavAriaLabel}
          subnavItems={subnavItems}
        />
      ) : null}
      <AppMain className={mainClassName}>
        <Suspense fallback={null}>{children}</Suspense>
      </AppMain>
      {active ? fab : null}
    </>
  );
}
