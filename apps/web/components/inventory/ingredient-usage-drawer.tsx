"use client";

import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName, drawerFormFullWidthButtonClassName } from "@/lib/ui/drawer-form-section";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { MenuItem } from "@/lib/types/menu";

type IngredientUsageDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientName: string;
  dishes: MenuItem[];
};

export function IngredientUsageDrawer({
  open,
  onOpenChange,
  ingredientName,
  dishes,
}: IngredientUsageDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className={drawerContentClassName("usage")}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Verwendung im Rezept
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Speisen, in denen „{ingredientName}“ im Rezept hinterlegt ist.
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection>
          {dishes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Diese Zutat ist aktuell in keinem Gericht-Rezept verknüpft.
            </p>
          ) : (
            <ul className="space-y-2">
              {dishes.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/70 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <UtensilsCrossed className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{d.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full"
                    render={
                      <Link
                        href={`/dashboard/menu/uebersicht?dish=${encodeURIComponent(d.id)}`}
                        prefetch
                      />
                    }
                    onClick={() => onOpenChange(false)}
                  >
                    Zur Speisekarte
                  </Button>
                </li>
              ))}
            </ul>
          )}
          </DrawerFormSection>
        </div>
        <div className="border-t border-border/50 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className={drawerFormFullWidthButtonClassName}
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
