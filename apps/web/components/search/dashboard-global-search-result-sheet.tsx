"use client";

import { useRouter } from "next/navigation";
import {
  DASHBOARD_GLOBAL_SEARCH_CATEGORY_LABELS,
  dashboardGlobalSearchEntityCtaLabel,
  dashboardGlobalSearchHasEntityDeepLink,
  dashboardGlobalSearchModuleCtaLabel,
  dashboardGlobalSearchModuleHref,
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
  const category = item?.category;
  const categoryLabel = category
    ? DASHBOARD_GLOBAL_SEARCH_CATEGORY_LABELS[category]
    : "";
  const hasEntityLink = category
    ? dashboardGlobalSearchHasEntityDeepLink(category)
    : false;
  const entityCta = category
    ? dashboardGlobalSearchEntityCtaLabel(category)
    : "Öffnen";
  const moduleCta = category
    ? dashboardGlobalSearchModuleCtaLabel(category)
    : "Zum Modul";
  const moduleHref = category ? dashboardGlobalSearchModuleHref(category) : null;
  const dayHref =
    category === "reservations" &&
    item?.dayYmd &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.dayYmd)
      ? dashboardGlobalSearchReservationDayHref(item.dayYmd)
      : null;

  const navigate = (href: string) => {
    onOpenChange(false);
    forceResetAppScrollLocks();
    router.push(href);
  };

  const goToEntity = () => {
    if (!item) return;
    navigate(item.href);
  };

  const goToModule = () => {
    if (!moduleHref) return;
    navigate(moduleHref);
  };

  const primaryLabel = hasEntityLink ? entityCta : moduleCta;
  const primaryAction = hasEntityLink ? goToEntity : goToModule;

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
            {hasEntityLink
              ? "Eintrag direkt öffnen oder nur zum Modul wechseln."
              : "Im Modul öffnen, um den Eintrag im gewohnten Kontext zu sehen."}
          </p>
          {dayHref ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-border/60"
              onClick={() => navigate(dayHref)}
            >
              Zum Tag
            </Button>
          ) : null}
          {hasEntityLink && moduleHref ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-border/60"
              onClick={goToModule}
            >
              {moduleCta}
            </Button>
          ) : null}
        </div>

        <DrawerFormFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Zurück"
          showSubmit
          submitType="button"
          submitLabel={primaryLabel}
          onSubmit={primaryAction}
          contentPadding={6}
        />
      </DrawerContent>
    </Drawer>
  );
}
