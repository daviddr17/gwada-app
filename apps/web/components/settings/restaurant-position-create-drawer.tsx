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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RestaurantPositionColorField,
  resolvePositionColorInput,
  restaurantPositionDrawerLabelClassName,
} from "@/components/settings/restaurant-position-color-field";
import { RestaurantPositionPermissionFields } from "@/components/settings/restaurant-position-permission-fields";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { pickRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";

type RestaurantPositionCreateDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  onCreate: (payload: {
    name: string;
    color: string;
    permissionKeys: RestaurantPermissionKey[];
  }) => void;
};

export function RestaurantPositionCreateDrawer({
  open,
  onOpenChange,
  pending = false,
  onCreate,
}: RestaurantPositionCreateDrawerProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748b");
  const [permDraft, setPermDraft] = useState<Set<RestaurantPermissionKey>>(
    new Set(),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setName("");
      setColor(pickRestaurantPositionColor(`new-${Date.now()}`));
      setPermDraft(new Set());
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const togglePerm = (key: RestaurantPermissionKey, on: boolean) => {
    setPermDraft((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    onCreate({
      name: trimmed,
      color: resolvePositionColorInput(color, trimmed),
      permissionKeys: [...permDraft],
    });
  };

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
            Neue Position
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Name, Farbe und Berechtigungen für die neue Restaurant-Position.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-4">
            <div className="space-y-2">
              <Label
                htmlFor="position-create-name"
                className={restaurantPositionDrawerLabelClassName}
              >
                Name
              </Label>
              <Input
                id="position-create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Bar"
                className="h-12 rounded-xl"
                autoFocus
              />
            </div>

            <RestaurantPositionColorField
              idPrefix="position-create"
              color={color}
              onColorChange={setColor}
              fallbackSeed={name || "new-position"}
            />

            <div className="space-y-2">
              <Label className={restaurantPositionDrawerLabelClassName}>
                Berechtigungen
              </Label>
              <p className="text-xs text-muted-foreground">
                Lege fest, was diese Position direkt beim Anlegen darf.
              </p>
              <RestaurantPositionPermissionFields
                idPrefix="perm-create"
                permDraft={permDraft}
                onToggle={togglePerm}
              />
            </div>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitLabel="Anlegen"
            submitPending={pending}
            submitDisabled={!name.trim()}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
