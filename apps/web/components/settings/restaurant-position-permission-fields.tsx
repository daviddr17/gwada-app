"use client";

import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import {
  RESTAURANT_PERMISSION_CATALOG,
  type RestaurantPermissionKey,
} from "@/lib/permissions/restaurant-permissions";

const GROUP_LABEL = {
  administration: "Verwaltung",
  module: "Module",
  einstellungen: "Einstellungen",
  integrationen: "Integrationen",
  dokumente: "Dokumente",
  buchfuehrung: "Buchführung",
  display: "Display",
  pos: "Kasse",
} as const;

const GROUP_ORDER = [
  "administration",
  "module",
  "einstellungen",
  "integrationen",
  "dokumente",
  "buchfuehrung",
  "display",
  "pos",
] as const;

type RestaurantPositionPermissionFieldsProps = {
  permDraft: Set<RestaurantPermissionKey>;
  onToggle: (key: RestaurantPermissionKey, on: boolean) => void;
  idPrefix: string;
};

export function RestaurantPositionPermissionFields({
  permDraft,
  onToggle,
  idPrefix,
}: RestaurantPositionPermissionFieldsProps) {
  const byGroup = useMemo(
    () =>
      RESTAURANT_PERMISSION_CATALOG.reduce(
        (acc, item) => {
          (acc[item.group] ??= []).push(item);
          return acc;
        },
        {} as Record<string, typeof RESTAURANT_PERMISSION_CATALOG[number][]>,
      ),
    [],
  );

  const orderedGroups = GROUP_ORDER.filter((group) => byGroup[group]?.length);

  return (
    <div className="space-y-6">
      {orderedGroups.map((group) => {
        const items = byGroup[group]!;
        return (
          <div key={group} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {GROUP_LABEL[group as keyof typeof GROUP_LABEL] ?? group}
            </h3>
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span
                      id={`${idPrefix}-${item.key}-label`}
                      className="block text-sm font-medium"
                    >
                      {item.label}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Switch
                    id={`${idPrefix}-${item.key}`}
                    checked={permDraft.has(item.key)}
                    onCheckedChange={(v) => onToggle(item.key, v === true)}
                    aria-labelledby={`${idPrefix}-${item.key}-label`}
                    className="shrink-0"
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function permissionSetsEqual(
  a: Set<RestaurantPermissionKey>,
  b: Set<RestaurantPermissionKey>,
): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) {
    if (!b.has(key)) return false;
  }
  return true;
}
