"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setName("");
      setAllowedModules(["time"]);
      setAutoLockSeconds("60");
      setIsActive(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

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
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Neues Display
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Name, Module und Auto-Lock für das Tablet-Display.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-4">
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

            <RestaurantDisplayModuleFields
              idPrefix="display-create"
              allowedModules={allowedModules}
              onChange={setAllowedModules}
            />

            <div className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
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
