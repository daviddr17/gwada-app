"use client";

import type { DisplayModuleMeta } from "@/lib/display/display-types";
import type { DisplayModule, DisplaySessionStaff } from "@/lib/display/display-types";
import { DisplayLoggedInFooter } from "@/components/display/display-logged-in-footer";
import { DisplayModuleIcon } from "@/components/display/display-module-icon";
import { DisplayRestaurantHeading } from "@/components/display/display-restaurant-heading";
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
  onTodoChanged,
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
  onTodoChanged?: () => void;
  children: React.ReactNode;
}) {
  const activeMeta = modules.find((m) => m.id === activeModule);
  const activeLabel = activeMeta?.label ?? activeModule;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <DisplayRestaurantHeading
            name={restaurantName}
            avatarUrl={restaurantAvatarUrl}
            size="md"
            logoSize="avatar-sm"
          />
          <DisplayStaffLine
            staff={staff}
            suffix={displayName}
            todoBadge={
              <DisplayStaffTodoBadge
                count={todoBadgeCount ?? 0}
                onChanged={onTodoChanged}
              />
            }
            className="mt-1.5"
          />
        </div>
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
      <DisplayLoggedInFooter onLogout={onLogout} />
    </div>
  );
}
