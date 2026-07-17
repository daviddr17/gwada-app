"use client";

import { useState } from "react";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { toast } from "sonner";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspaceRestaurant,
  createWorkspaceRestaurantErrorKey,
} from "@/lib/restaurant/create-workspace-restaurant";
import { RESTAURANT_SLUG_TAKEN_MESSAGE } from "@/lib/restaurant/restaurant-slug";

const DRAWER_ERROR_DE: Record<
  Exclude<ReturnType<typeof createWorkspaceRestaurantErrorKey>, "slug_taken">,
  string
> = {
  "errors.nameRequired": "Bitte einen Restaurantnamen eintragen.",
  "errors.authRequired": "Bitte zuerst anmelden.",
  "errors.membershipFailed": "Zuordnung zum Restaurant ist fehlgeschlagen.",
  "errors.activeFailed": "Aktives Restaurant konnte nicht gesetzt werden.",
  "errors.createFailed": "Restaurant konnte nicht angelegt werden.",
};

/**
 * Legacy compact create drawer — prefer `RestaurantSetupWizardOverlay`
 * via `useRestaurantSetupWizard().openWizard()`.
 */
export function NewRestaurantDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setSlugOverride("");
  };

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const result = await createWorkspaceRestaurant({
        name,
        slugOverride,
      });
      if (!result.ok) {
        const errKey = createWorkspaceRestaurantErrorKey(result.error);
        toast.error(
          errKey === "slug_taken"
            ? RESTAURANT_SLUG_TAKEN_MESSAGE
            : DRAWER_ERROR_DE[errKey],
        );
        return;
      }
      toast.success("Restaurant angelegt und als aktiv gesetzt.");
      reset();
      onOpenChange(false);
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className="text-left">
          <DrawerTitle>Neues Restaurant</DrawerTitle>
          <DrawerDescription>
            Name und optionaler Kurzname für die URL. Du wirst als Inhaber
            eingetragen; das neue Restaurant ist sofort aktiv.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className={drawerScrollAreaClassName(4)}>
            <DrawerFormSection contentPadding={4}>
              <div className="space-y-2">
                <Label htmlFor="nr-name">Restaurantname</Label>
                <Input
                  id="nr-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Lion Bistro"
                  className="h-11 rounded-xl"
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr-slug">URL-Slug (optional)</Label>
                <Input
                  id="nr-slug"
                  value={slugOverride}
                  onChange={(e) => setSlugOverride(e.target.value)}
                  placeholder="Leer = aus dem Namen abgeleitet"
                  className="h-11 rounded-xl"
                  autoComplete="off"
                />
              </div>
            </DrawerFormSection>
          </div>
          <DrawerFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy}
            >
              {busy ? "Wird angelegt…" : "Anlegen"}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
