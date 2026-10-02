"use client";

import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatPurchaseOrderCompletionExceptionDetail } from "@/lib/live-activity/purchase-order-completion-feed";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

/** Ausnahmen einer abgeschlossenen Bestellung — ohne die voll gelieferten Zeilen. */
export function PurchaseOrderCompletionLiveSheet({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: LiveActivityItem | null;
}) {
  const completion = item?.purchaseOrderCompletion;
  if (!item || !completion) return null;

  const href =
    item.href ??
    `/dashboard/inventory/purchase-orders?order=${encodeURIComponent(completion.orderId)}`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {item.title}
          </DrawerTitle>
          {item.description ? (
            <DrawerDescription>{item.description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {completion.exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Alle Positionen wurden vollständig geliefert.
            </p>
          ) : (
            <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50">
              {completion.exceptions.map((line, index) => (
                <li key={`${line.status}:${line.ingredientName}:${index}`} className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    {line.ingredientName}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    {formatPurchaseOrderCompletionExceptionDetail(line)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border/50 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <Button
            render={
              <AppNavLink href={href} onClick={() => onOpenChange(false)} />
            }
            className={cn("h-12 w-full", brandActionButtonRoundedClassName)}
          >
            Bestellung öffnen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
