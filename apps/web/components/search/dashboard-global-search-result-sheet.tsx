"use client";

import { useRouter } from "next/navigation";
import {
  DASHBOARD_GLOBAL_SEARCH_CATEGORY_LABELS,
  dashboardGlobalSearchReservationDayHref,
} from "@/lib/dashboard/dashboard-global-search-nav";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { forceResetAppScrollLocks } from "@/lib/layout/app-scroll-root";
import type { DashboardGlobalSearchResultItem } from "@/lib/types/dashboard-global-search";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";

type DashboardGlobalSearchResultSheetProps = {
  open: boolean;
  item: DashboardGlobalSearchResultItem | null;
  onOpenChange: (open: boolean) => void;
};

export function DashboardGlobalSearchResultSheet({
  open,
  item,
  onOpenChange,
}: DashboardGlobalSearchResultSheetProps) {
  const router = useRouter();
  const categoryLabel = item
    ? DASHBOARD_GLOBAL_SEARCH_CATEGORY_LABELS[item.category]
    : "";
  const dayHref =
    item?.category === "reservations" &&
    item.dayYmd &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.dayYmd)
      ? dashboardGlobalSearchReservationDayHref(item.dayYmd)
      : null;

  const goToModule = () => {
    if (!item) return;
    const href = item.href;
    onOpenChange(false);
    forceResetAppScrollLocks();
    router.push(href);
  };

  const goToDay = () => {
    if (!dayHref) return;
    onOpenChange(false);
    forceResetAppScrollLocks();
    router.push(dayHref);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("export")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {categoryLabel || "Treffer"}
          </p>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {item?.title ?? "Suchergebnis"}
          </DrawerTitle>
          {item?.subtitle ? (
            <DrawerDescription className="text-base text-muted-foreground">
              {item.subtitle}
            </DrawerDescription>
          ) : (
            <DrawerDescription className="sr-only">
              {categoryLabel
                ? `Treffer in ${categoryLabel}`
                : "Suchergebnis öffnen"}
            </DrawerDescription>
          )}
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6, "space-y-3 pb-2")}>
          <p className="text-sm text-muted-foreground">
            Im Modul öffnen, um den Eintrag im gewohnten Kontext zu sehen und zu
            bearbeiten.
          </p>
          {dayHref ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-border/60"
              onClick={goToDay}
            >
              Zum Tag
            </Button>
          ) : null}
        </div>

        <DrawerFormFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Zurück"
          showSubmit
          submitType="button"
          submitLabel={categoryLabel ? `Zu ${categoryLabel}` : "Im Modul öffnen"}
          onSubmit={goToModule}
          contentPadding={6}
        />
      </DrawerContent>
    </Drawer>
  );
}
