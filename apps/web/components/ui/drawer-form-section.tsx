"use client";

import type { ReactNode } from "react";
import {
  drawerFormSectionClassName,
  drawerFormSectionTitleClassName,
  drawerScrollAreaClassName,
  type DrawerContentPadding,
  type DrawerFormSectionBleed,
} from "@/lib/ui/drawer-form-section";

export function DrawerFormSection({
  title,
  children,
  contentPadding = 6,
  bleed = true,
  className,
}: {
  title?: string;
  children: ReactNode;
  contentPadding?: DrawerContentPadding;
  /** `column` = volle Breite auf schmal, auf lg kein Überstand (Zweispalter). */
  bleed?: DrawerFormSectionBleed;
  className?: string;
}) {
  return (
    <section
      className={drawerFormSectionClassName(contentPadding, className, bleed)}
    >
      {title ? (
        <h3 className={drawerFormSectionTitleClassName}>{title}</h3>
      ) : null}
      {children}
    </section>
  );
}

export function DrawerFormScrollArea({
  contentPadding = 6,
  className,
  children,
}: {
  contentPadding?: DrawerContentPadding;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={drawerScrollAreaClassName(contentPadding, className)}>
      {children}
    </div>
  );
}
