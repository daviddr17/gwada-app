"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DISPLAY_MODULES,
  type DisplayModule,
} from "@/lib/display/display-types";
import { restaurantPositionDrawerLabelClassName } from "@/components/settings/restaurant-position-color-field";

type RestaurantDisplayModuleFieldsProps = {
  idPrefix: string;
  allowedModules: DisplayModule[];
  onChange: (next: DisplayModule[]) => void;
};

export function RestaurantDisplayModuleFields({
  idPrefix,
  allowedModules,
  onChange,
}: RestaurantDisplayModuleFieldsProps) {
  return (
    <div className="space-y-2">
      <Label className={restaurantPositionDrawerLabelClassName}>
        Module auf diesem Display
      </Label>
      <div className="grid gap-2">
        {DISPLAY_MODULES.filter((m) => m.id !== "kds").map((mod) => {
          const checked = allowedModules.includes(mod.id);
          return (
            <div
              key={mod.id}
              className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span
                  id={`${idPrefix}-mod-${mod.id}-label`}
                  className="block text-sm font-medium"
                >
                  {mod.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {mod.description}
                </span>
              </span>
              <Switch
                id={`${idPrefix}-mod-${mod.id}`}
                checked={checked}
                onCheckedChange={(on) => {
                  const next = on
                    ? [...allowedModules, mod.id]
                    : allowedModules.filter((x) => x !== mod.id);
                  onChange(next as DisplayModule[]);
                }}
                aria-labelledby={`${idPrefix}-mod-${mod.id}-label`}
                className="shrink-0"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
