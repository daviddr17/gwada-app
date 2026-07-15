"use client";

import { useState } from "react";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RestaurantDisplayModuleFields } from "@/components/settings/restaurant-display-module-fields";
import { restaurantPositionDrawerLabelClassName } from "@/components/settings/restaurant-position-color-field";
import type { DisplayModule } from "@/lib/display/display-types";

export type RestaurantDisplayCreatePayload = {
  name: string;
  allowed_modules: DisplayModule[];
  auto_lock_seconds: number;
  is_active: boolean;
};

type RestaurantDisplayCreateDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  onCreate: (payload: RestaurantDisplayCreatePayload) => void;
};

export function RestaurantDisplayCreateDrawer({
  open,
  onOpenChange,
  pending = false,
  onCreate,
}: RestaurantDisplayCreateDrawerProps) {
  const [name, setName] = useState("");
  const [allowedModules, setAllowedModules] = useState<DisplayModule[]>([
    "time",
  ]);
  const [autoLockSeconds, setAutoLockSeconds] = useState("60");
  const [isActive, setIsActive] = useState(true);

  useDrawerFormSeed(open, "__create__", () => {
    setName("");
    setAllowedModules(["time"]);
    setAutoLockSeconds("60");
    setIsActive(true);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const lock = Number.parseInt(autoLockSeconds, 10);
    if (!trimmed || pending || !Number.isFinite(lock)) return;
    onCreate({
      name: trimmed,
      allowed_modules: allowedModules,
      auto_lock_seconds: Math.min(3600, Math.max(15, lock)),
      is_active: isActive,
    });
  };

  const lockValue = Number.parseInt(autoLockSeconds, 10);
  const lockValid = Number.isFinite(lockValue) && lockValue >= 15 && lockValue <= 3600;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Neues Display
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Name, Module und Auto-Lock für das Tablet-Display.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Allgemein">
              <div className="space-y-2">
                <Label
                  htmlFor="display-create-name"
                  className={restaurantPositionDrawerLabelClassName}
                >
                  Name
                </Label>
                <Input
                  id="display-create-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Küche, Personalraum, Theke"
                  className="h-12 rounded-xl"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="display-create-lock"
                  className={restaurantPositionDrawerLabelClassName}
                >
                  Auto-Lock (Sekunden)
                </Label>
                <Input
                  id="display-create-lock"
                  type="number"
                  min={15}
                  max={3600}
                  value={autoLockSeconds}
                  onChange={(e) => setAutoLockSeconds(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Module">
              <RestaurantDisplayModuleFields
                idPrefix="display-create"
                allowedModules={allowedModules}
                onChange={setAllowedModules}
              />
            </DrawerFormSection>

            <DrawerFormSection title="Status">
              <div className="flex items-center justify-between gap-3">
                <span
                  id="display-create-active-label"
                  className="flex-1 text-sm font-medium"
                >
                  Display aktiv
                </span>
                <Switch
                  id="display-create-active"
                  checked={isActive}
                  onCheckedChange={(on) => setIsActive(Boolean(on))}
                  aria-labelledby="display-create-active-label"
                  className="shrink-0"
                />
              </div>
            </DrawerFormSection>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitLabel="Anlegen"
            submitPending={pending}
            submitDisabled={!name.trim() || !lockValid}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
