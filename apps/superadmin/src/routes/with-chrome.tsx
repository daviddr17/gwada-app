"use client";

import type { ComponentType, ReactNode } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

export function SuperadminChromeRoute({
  title,
  subnavAriaLabel,
  subnavItems,
  children,
}: {
  title: string;
  subnavAriaLabel: string;
  subnavItems: readonly ModuleSubnavItem[];
  children: ReactNode;
}) {
  return (
    <>
      <RegisterModuleChrome
        title={title}
        subnavAriaLabel={subnavAriaLabel}
        subnavItems={subnavItems}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}

export function wrapSuperadminPage(
  title: string,
  subnavAriaLabel: string,
  subnavItems: readonly ModuleSubnavItem[],
  Page: ComponentType,
): ComponentType {
  function Wrapped() {
    return (
      <SuperadminChromeRoute
        title={title}
        subnavAriaLabel={subnavAriaLabel}
        subnavItems={subnavItems}
      >
        <Page />
      </SuperadminChromeRoute>
    );
  }
  Wrapped.displayName = `SuperadminChrome(${title})`;
  return Wrapped;
}
