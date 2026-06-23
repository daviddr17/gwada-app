"use client";

import type { ReactNode } from "react";
import type { DisplayModuleMeta } from "@/lib/display/display-types";
import type { DisplayModule, DisplaySessionStaff } from "@/lib/display/display-types";
import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";
import { DisplayChromeHeader } from "@/components/display/display-chrome-header";
import { DisplayContextFooter } from "@/components/display/display-context-footer";
import { DisplayLockOverlay } from "@/components/display/display-pin-pad";
import { DisplayModuleIcon } from "@/components/display/display-module-icon";
import { DisplayStaffLine } from "@/components/display/display-staff-line";
import { DisplayStaffTodoBadge } from "@/components/display/display-staff-todo-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  displayChromeContentWrapClassName,
  displayChromeMainClassName,
  displayChromeShellClassName,
} from "@/lib/ui/display-chrome";
import { cn } from "@/lib/utils";

export function DisplayModuleShell({
  restaurantName,
  restaurantAvatarUrl,
  displayName,
  staff,
  staffSuffix,
  modules,
  activeModule,
  canSwitch,
  onModuleChange,
  onLogout,
  todoBadgeCount,
  todoBadgeUrgency = "green",
  onTodoChanged,
  locked = false,
  onUnlock,
  lockBusy = false,
  lockError = null,
  children,
}: {
  restaurantName: string;
  restaurantAvatarUrl: string | null;
  displayName: string;
  staff: DisplaySessionStaff;
  /** z. B. Zeiterfassungsstatus neben Name/Position. */
  staffSuffix?: ReactNode;
  modules: DisplayModuleMeta[];
  activeModule: DisplayModule;
  canSwitch: boolean;
  onModuleChange: (mod: DisplayModule) => void;
  onLogout: () => void;
  todoBadgeCount?: number;
  todoBadgeUrgency?: StaffTodoDisplayUrgency;
  onTodoChanged?: () => void;
  locked?: boolean;
  onUnlock?: (pin: string) => void;
  lockBusy?: boolean;
  lockError?: string | null;
  children: ReactNode;
}) {
  const activeMeta = modules.find((m) => m.id === activeModule);
  const activeLabel = activeMeta?.label ?? activeModule;

  const moduleTrailing =
    canSwitch && modules.length > 1 ? (
      <Select
        value={activeModule}
        onValueChange={(v) => onModuleChange(v as DisplayModule)}
      >
        <SelectTrigger
          className={appSelectTriggerAccentCn("h-9 min-w-[10rem] rounded-xl text-sm")}
        >
          <SelectValue>
            <span className="flex items-center gap-2">
              <DisplayModuleIcon
                module={activeModule}
                className="size-4 text-accent"
              />
              {activeLabel}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {modules.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex items-center gap-2">
                <DisplayModuleIcon module={m.id} className="size-4 text-accent" />
                {m.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/50 px-3 text-sm font-medium">
        <DisplayModuleIcon module={activeModule} className="size-4 text-accent" />
        {activeLabel}
      </span>
    );

  return (
    <div className={displayChromeShellClassName}>
      <DisplayChromeHeader trailing={moduleTrailing}>
        <DisplayStaffLine
          staff={staff}
          suffix={staffSuffix}
          className="min-w-0 text-sm"
        />
      </DisplayChromeHeader>

      <div className={displayChromeContentWrapClassName}>
        {onUnlock ? (
          <DisplayLockOverlay
            open={locked}
            placement="content"
            onUnlock={onUnlock}
            busy={lockBusy}
            error={lockError}
          />
        ) : null}
        <main className={cn(displayChromeMainClassName, "p-4 sm:p-6")}>
          {children}
        </main>
      </div>

      <DisplayContextFooter
        restaurantName={restaurantName}
        restaurantAvatarUrl={restaurantAvatarUrl}
        displayName={displayName}
        showLogout={!locked}
        onLogout={onLogout}
        todoBadge={
          <DisplayStaffTodoBadge
            count={todoBadgeCount ?? 0}
            urgency={todoBadgeUrgency}
            onChanged={onTodoChanged}
          />
        }
      />
    </div>
  );
}
