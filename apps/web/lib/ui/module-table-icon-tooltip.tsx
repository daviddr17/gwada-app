"use client";

import type { LucideIcon } from "lucide-react";
import { MousePointer2 } from "lucide-react";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  moduleDataTableActionsCellClassName,
  moduleDataTableActionsColumnClassName,
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadCellCompactClassName,
  moduleDataTableHeadCellDenseClassName,
} from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";

const moduleTableIconHeaderClassName =
  "inline-flex cursor-default items-center justify-center text-secondary-foreground outline-none";

/** Tabellenkopf — nur Icon, mit Tooltip für die Spaltenbedeutung. */
export function ModuleTableIconColumnHeader({
  label,
  icon,
  className,
  dense = false,
  compact = false,
}: {
  label: string;
  icon: ReactNode;
  className?: string;
  /** Enge Tabellen (Bestand, Kontakte). */
  dense?: boolean;
  /** Protokoll-/Drawer-Tabellen (kompakter Kopf). */
  compact?: boolean;
}) {
  const cellClass = compact
    ? moduleDataTableHeadCellCompactClassName
    : dense
      ? moduleDataTableHeadCellDenseClassName
      : moduleDataTableHeadCellClassName;

  return (
    <th className={cn(cellClass, "text-center", className)}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn(moduleTableIconHeaderClassName, "mx-auto")}
              tabIndex={0}
              aria-label={label}
            />
          }
        >
          {icon}
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </th>
  );
}

type ModuleTableIconActionButtonProps = ComponentProps<typeof Button> & {
  label: string;
};

/** Tabellenzeile — Icon-Button mit Tooltip (Aktion beschreiben). */
export function ModuleTableIconActionButton({
  label,
  children,
  className,
  disabled,
  type = "button",
  variant = "ghost",
  size = "icon-sm",
  ...props
}: ModuleTableIconActionButtonProps) {
  const button = (
    <Button
      type={type}
      variant={variant}
      size={size}
      aria-label={label}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          disabled ? (
            <span
              className="inline-flex"
              tabIndex={0}
              aria-label={label}
            />
          ) : (
            button
          )
        }
      >
        {disabled ? button : null}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Einheitlicher Kopf der Aktionen-Spalte (Icon + Tooltip „Aktionen“). */
export function ModuleTableIconActionsColumnHeader({
  label = "Aktionen",
  className,
  icon: Icon = MousePointer2,
  dense = false,
  compact = false,
}: {
  label?: string;
  className?: string;
  icon?: LucideIcon;
  dense?: boolean;
  compact?: boolean;
}) {
  const cellClass = compact
    ? moduleDataTableHeadCellCompactClassName
    : dense
      ? moduleDataTableHeadCellDenseClassName
      : moduleDataTableHeadCellClassName;

  return (
    <th
      className={cn(
        cellClass,
        !dense && !compact && moduleDataTableActionsColumnClassName,
        "text-right",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn(moduleTableIconHeaderClassName, "ml-auto")}
              tabIndex={0}
              aria-label={label}
            />
          }
        >
          <Icon className="size-3.5 opacity-70" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </th>
  );
}

/** Zelle für Icon-Aktionen — rechtsbündig, einheitlicher Abstand. */
export function ModuleTableActionsCell({
  children,
  className,
  onClick,
  dense = false,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLTableCellElement>) => void;
  dense?: boolean;
  compact?: boolean;
}) {
  return (
    <td
      className={cn(
        !dense && !compact && moduleDataTableActionsCellClassName,
        dense && "px-1 py-1.5 text-center",
        compact && "px-3 py-2.5",
        className,
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "flex shrink-0 gap-0.5",
          dense ? "justify-center" : "justify-end",
        )}
      >
        {children}
      </div>
    </td>
  );
}
