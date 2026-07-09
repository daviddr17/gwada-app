"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { AppFullscreenOverlay } from "@/components/ui/app-fullscreen-overlay";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ListPagination,
  ListPaginationSurround,
  type ListPaginationProps,
} from "@/components/ui/list-pagination";
import {
  moduleDataTableFullscreenShellClassName,
  moduleListPaginationAboveClassName,
  moduleListPaginationBelowClassName,
  moduleTableFullscreenChromeInsetClassName,
} from "@/lib/ui/module-data-table";
import {
  moduleTableFullscreenBodyScrollClassName,
  moduleTableFullscreenToggleButtonClassName,
} from "@/lib/ui/module-paginated-data-table";
import { ModuleTableHorizontalScrollRegion } from "@/lib/ui/module-table-sticky-column";
import { cn } from "@/lib/utils";

export type SuperadminTableFullscreenSurroundProps = ListPaginationProps & {
  children: ReactNode;
  /** Tabelleninhalt im Vollbild (z. B. mit `embedded` auf SuperadminDataTable). */
  fullscreenChildren: ReactNode;
  overlayLabel: string;
  summaryText?: string;
  classNameAbove?: string;
  classNameBelow?: string;
  tableFullscreen?: boolean;
};

export function SuperadminTableFullscreenSurround({
  children,
  fullscreenChildren,
  overlayLabel,
  summaryText,
  classNameAbove,
  classNameBelow,
  tableFullscreen = true,
  totalPages,
  canNext,
  ...paginationProps
}: SuperadminTableFullscreenSurroundProps) {
  const [expanded, setExpanded] = useState(false);
  const closeFullscreen = useCallback(() => setExpanded(false), []);

  const expandButton =
    tableFullscreen && !expanded ? (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={moduleTableFullscreenToggleButtonClassName}
              onClick={() => setExpanded(true)}
              aria-label={`${overlayLabel} im Vollbild anzeigen`}
            />
          }
        >
          <Maximize2 className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="top">Vollbild</TooltipContent>
      </Tooltip>
    ) : null;

  const paginationCommon = {
    totalPages,
    canNext,
    ...paginationProps,
  };

  return (
    <>
      {!expanded ? (
        <ListPaginationSurround
          {...paginationCommon}
          classNameAbove={cn(moduleListPaginationAboveClassName, classNameAbove)}
          classNameBelow={cn(moduleListPaginationBelowClassName, classNameBelow)}
          paginationTrailingAbove={expandButton}
        >
          {children}
        </ListPaginationSurround>
      ) : null}

      <AppFullscreenOverlay
        open={expanded}
        onClose={closeFullscreen}
        aria-label={overlayLabel}
        header={
          <div
            className={cn(
              "flex w-full items-center justify-between gap-3 py-3",
              moduleTableFullscreenChromeInsetClassName,
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {overlayLabel}
              </p>
              {summaryText ? (
                <p className="truncate text-sm text-muted-foreground tabular-nums">
                  {summaryText}
                </p>
              ) : null}
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={moduleTableFullscreenToggleButtonClassName}
                    onClick={closeFullscreen}
                    aria-label="Vollbild schließen"
                  />
                }
              >
                <Minimize2 className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="top">Vollbild schließen</TooltipContent>
            </Tooltip>
          </div>
        }
        footer={
          <ListPagination
            {...paginationCommon}
            placement="below"
            showSummary={totalPages > 1 || canNext}
            className={cn(
              moduleListPaginationBelowClassName,
              moduleTableFullscreenChromeInsetClassName,
              "border-t-0 pt-3",
            )}
          />
        }
      >
        {expanded ? (
          <ModuleTableHorizontalScrollRegion
            className={moduleTableFullscreenBodyScrollClassName}
          >
            <div
              className={moduleDataTableFullscreenShellClassName}
              data-module-table-fullscreen
            >
              {fullscreenChildren}
            </div>
          </ModuleTableHorizontalScrollRegion>
        ) : null}
      </AppFullscreenOverlay>
    </>
  );
}
