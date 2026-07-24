"use client";

import type { ReactNode } from "react";
import {
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import {
  drawerFilterFieldGroupClassName,
  drawerFilterFieldLabelClassName,
  drawerFilterHeaderTitleClassName,
  drawerFilterSwitchRowClassName,
  drawerFilterZoneClassName,
  drawerFilterZoneLabelClassName,
  drawerFilterZoneShellClassName,
  drawerSortZoneClassName,
  drawerSortZoneLabelClassName,
} from "@/lib/ui/drawer-filter-sheet";
import type {
  DrawerContentPadding,
  DrawerFormSectionBleed,
} from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

/** Kopf ohne Beschreibung — nur prägnanter Titel. */
export function DrawerFilterHeader({
  title,
  contentPadding = 6,
  className,
}: {
  title: string;
  contentPadding?: DrawerContentPadding;
  className?: string;
}) {
  return (
    <DrawerHeader className={cn(drawerFormHeaderClassName(contentPadding), className)}>
      <DrawerTitle className={drawerFilterHeaderTitleClassName}>{title}</DrawerTitle>
    </DrawerHeader>
  );
}

export function DrawerFilterZone({
  children,
  contentPadding = 6,
  bleed = true,
  className,
  showLabel = true,
}: {
  children: ReactNode;
  contentPadding?: DrawerContentPadding;
  bleed?: DrawerFormSectionBleed;
  className?: string;
  /** Bei reinen Filter-Sheets mit Titel „Filter“ oft überflüssig. */
  showLabel?: boolean;
}) {
  return (
    <div className={drawerFilterZoneShellClassName(contentPadding, bleed)}>
      <div className={cn(drawerFilterZoneClassName, className)}>
        {showLabel ? (
          <p className={drawerFilterZoneLabelClassName}>Filter</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function DrawerSortZone({
  children,
  contentPadding = 6,
  bleed = true,
  className,
}: {
  children: ReactNode;
  contentPadding?: DrawerContentPadding;
  bleed?: DrawerFormSectionBleed;
  className?: string;
}) {
  return (
    <div className={drawerFilterZoneShellClassName(contentPadding, bleed)}>
      <div className={cn(drawerSortZoneClassName, className)}>
        <p className={drawerSortZoneLabelClassName}>Sortierung</p>
        {children}
      </div>
    </div>
  );
}

/** Ein Schlagwort + Control — ohne Beschreibungstext. */
export function DrawerFilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(drawerFilterFieldGroupClassName, className)}>
      <label
        htmlFor={htmlFor}
        className={drawerFilterFieldLabelClassName}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function DrawerFilterSwitchRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(drawerFilterSwitchRowClassName, className)}>
      {children}
    </div>
  );
}
