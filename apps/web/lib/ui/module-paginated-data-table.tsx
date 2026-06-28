"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  AppFullscreenOverlay,
  appFullscreenOverlayScrollClassName,
} from "@/components/ui/app-fullscreen-overlay";
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
  moduleDataTableShellClassName,
  moduleListPaginationAboveClassName,
  moduleListPaginationBelowClassName,
  moduleTableFullscreenChromeInsetClassName,
} from "@/lib/ui/module-data-table";
import { ModuleTableHorizontalScrollRegion } from "@/lib/ui/module-table-sticky-column";
import { formatListPageSummary } from "@/lib/ui/list-range-count";
import { cn } from "@/lib/utils";

/** Vollbild-Toggle in der oberen Pagination-Zeile — optisch wie Filter-Icon. */
export const moduleTableFullscreenToggleButtonClassName =
  "size-9 shrink-0 rounded-full border-border/60";

/** Scroll-Bereich für Tabellen im Vollbild (eine Tabelle, sticky thead). */
export const moduleTableFullscreenBodyScrollClassName = cn(
  appFullscreenOverlayScrollClassName,
  "w-full overflow-auto",
);

export type ModulePaginatedDataTableProps = ListPaginationProps & {
  children: ReactNode;
  classNameAbove?: string;
  classNameBelow?: string;
  scrollClassName?: string;
  shellClassName?: string;
  /** Tabellen-Vollbild (Standard: an). */
  tableFullscreen?: boolean;
  /** Titel im Vollbild-Overlay — Standard: `itemLabel`. */
  fullscreenTitle?: string;
  /** Seitlicher Einzug im Vollbild-Kopf/Fuß — an Tabellenzellen anpassen (Standard px-4). */
  fullscreenChromeInsetClassName?: string;
};

function ModuleTableShell({
  children,
  shellClassName,
  scrollClassName,
}: {
  children: ReactNode;
  shellClassName: string;
  scrollClassName?: string;
}) {
  return (
    <div className={shellClassName}>
      <ModuleTableHorizontalScrollRegion
        className={cn("overflow-x-auto", scrollClassName)}
      >
        {children}
      </ModuleTableHorizontalScrollRegion>
    </div>
  );
}

/**
 * Paginierte Modul-Tabelle — Anzahl/Seitensteuerung außerhalb der Tabellenhülle,
 * thead bündig oben mit Chrome-Hintergrund (Referenz: Checklisten-ToDos).
 */
export function ModulePaginatedDataTable({
  children,
  classNameAbove,
  classNameBelow,
  scrollClassName,
  shellClassName = moduleDataTableShellClassName,
  tableFullscreen = true,
  fullscreenTitle,
  fullscreenChromeInsetClassName = moduleTableFullscreenChromeInsetClassName,
  itemLabel,
  page,
  totalPages,
  shown,
  totalCount,
  ...paginationProps
}: ModulePaginatedDataTableProps) {
  const [expanded, setExpanded] = useState(false);
  const closeFullscreen = useCallback(() => setExpanded(false), []);

  const overlayLabel = fullscreenTitle?.trim() || itemLabel?.trim() || "Tabelle";
  const summaryText = formatListPageSummary({
    shown,
    totalCount,
    itemLabel,
    page,
    totalPages,
  });

  const paginationCommon = {
    page,
    totalPages,
    shown,
    totalCount,
    itemLabel,
    ...paginationProps,
  };

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

  const tableShell = (
    <ModuleTableShell shellClassName={shellClassName} scrollClassName={scrollClassName}>
      {children}
    </ModuleTableShell>
  );

  return (
    <>
      {!expanded ? (
        <ListPaginationSurround
          {...paginationCommon}
          classNameAbove={cn(moduleListPaginationAboveClassName, classNameAbove)}
          classNameBelow={cn(moduleListPaginationBelowClassName, classNameBelow)}
          paginationTrailingAbove={expandButton}
        >
          {tableShell}
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
              fullscreenChromeInsetClassName,
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
            showSummary={totalPages > 1 || paginationProps.canNext}
            className={cn(
              moduleListPaginationBelowClassName,
              fullscreenChromeInsetClassName,
              "border-t-0 pt-3",
            )}
          />
        }
      >
        {expanded ? (
          <ModuleTableHorizontalScrollRegion
            className={moduleTableFullscreenBodyScrollClassName}
          >
            <div className={moduleDataTableFullscreenShellClassName}>
              {children}
            </div>
          </ModuleTableHorizontalScrollRegion>
        ) : null}
      </AppFullscreenOverlay>
    </>
  );
}

export type ModuleDataTableFrameProps = {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
  shellClassName?: string;
  /** Tabellen-Vollbild (Protokoll-Listen). */
  tableFullscreen?: boolean;
  /** Titel im Vollbild-Overlay. */
  fullscreenTitle?: string;
  /** Kurztext über der Tabelle und im Overlay-Kopf (z. B. „12 Einträge“). */
  summaryText?: string;
  fullscreenChromeInsetClassName?: string;
};

/** Tabellenhülle ohne Pagination (Protokoll, Drawer). */
export function ModuleDataTableFrame({
  children,
  className,
  scrollClassName,
  shellClassName = moduleDataTableShellClassName,
  tableFullscreen = false,
  fullscreenTitle,
  summaryText,
  fullscreenChromeInsetClassName = moduleTableFullscreenChromeInsetClassName,
}: ModuleDataTableFrameProps) {
  const [expanded, setExpanded] = useState(false);
  const closeFullscreen = useCallback(() => setExpanded(false), []);

  const overlayLabel = fullscreenTitle?.trim() || "Tabelle";

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

  const tableShell = (
    <div className={cn(shellClassName, className)}>
      <ModuleTableHorizontalScrollRegion
        className={cn("overflow-x-auto", scrollClassName)}
      >
        {children}
      </ModuleTableHorizontalScrollRegion>
    </div>
  );

  const showToolbar = tableFullscreen && (summaryText || expandButton);

  return (
    <>
      {showToolbar ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            moduleListPaginationAboveClassName,
          )}
        >
          {summaryText ? (
            <p className="min-w-0 truncate text-sm text-muted-foreground tabular-nums">
              {summaryText}
            </p>
          ) : (
            <span aria-hidden />
          )}
          {expandButton}
        </div>
      ) : null}

      {!expanded ? tableShell : null}

      <AppFullscreenOverlay
        open={expanded}
        onClose={closeFullscreen}
        aria-label={overlayLabel}
        header={
          <div
            className={cn(
              "flex w-full items-center justify-between gap-3 py-3",
              fullscreenChromeInsetClassName,
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
      >
        {expanded ? (
          <ModuleTableHorizontalScrollRegion
            className={moduleTableFullscreenBodyScrollClassName}
          >
            <div className={moduleDataTableFullscreenShellClassName}>{children}</div>
          </ModuleTableHorizontalScrollRegion>
        ) : null}
      </AppFullscreenOverlay>
    </>
  );
}
