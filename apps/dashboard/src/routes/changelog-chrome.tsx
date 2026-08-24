"use client";

import type { ComponentType, ReactNode } from "react";
import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

/** Changelog-Modul-Chrome (früher Next layout unter `/changelog`). */
export function ChangelogChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <RegisterModuleChrome
        title="Changelog"
        subnavAriaLabel={null}
        subnavItems={null}
      />
      <AppMain>
        <div className="pt-2">{children}</div>
      </AppMain>
    </>
  );
}

export function wrapChangelogPage(Page: ComponentType): ComponentType {
  function Wrapped() {
    return (
      <ChangelogChrome>
        <Page />
      </ChangelogChrome>
    );
  }
  Wrapped.displayName = `ChangelogChrome(${Page.displayName ?? Page.name ?? "Page"})`;
  return Wrapped;
}
