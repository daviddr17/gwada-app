"use client";

import type { DisplayModuleMeta } from "@/lib/display/display-types";
import type { DisplayModule, DisplaySessionStaff } from "@/lib/display/display-types";
import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";
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
import { ModeToggle } from "@/components/theme/mode-toggle";

export function DisplayModuleShell({
  restaurantName,
  restaurantAvatarUrl,
  displayName,
  staff,
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
  children: React.ReactNode;
}) {
  const activeMeta = modules.find((m) => m.id === activeModule);
  const activeLabel = activeMeta?.label ?? activeModule;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {onUnlock ? (
          <DisplayLockOverlay
            open={locked}
            placement="content"
            onUnlock={onUnlock}
            busy={lockBusy}
            error={lockError}
          />
        ) : null}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3 sm:px-6">
        <DisplayStaffLine
          staff={staff}
          className="min-w-0 flex-1 text-base sm:text-sm"
        />
        <div className="flex items-center gap-2">
          <ModeToggle className="size-11 shrink-0 rounded-full sm:size-10" />
          {canSwitch && modules.length > 1 ? (
            <Select
              value={activeModule}
              onValueChange={(v) => onModuleChange(v as DisplayModule)}
            >
              <SelectTrigger
                className={appSelectTriggerAccentCn("h-11 min-w-[11rem] rounded-xl")}
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
            <span className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm font-medium">
              <DisplayModuleIcon module={activeModule} className="size-4 text-accent" />
              {activeLabel}
            </span>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
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
