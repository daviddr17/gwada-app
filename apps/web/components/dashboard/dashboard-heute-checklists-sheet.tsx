"use client";

import { ListChecks } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

function pluralDe(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function DashboardHeuteChecklistsSheet({
  open,
  onOpenChange,
  openTodos,
  overdueTodos,
  capturesToday,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openTodos: number;
  overdueTodos: number;
  capturesToday: number;
}) {
  const empty = openTodos === 0 && overdueTodos === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Aufgaben
          </DrawerTitle>
          <DrawerDescription>
            Offene und überfällige Todos aus Checklisten
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {empty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine offenen Aufgaben.
            </p>
          ) : (
            <ul className="space-y-2">
              {overdueTodos > 0 ? (
                <li className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <ListChecks className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">
                      {overdueTodos}{" "}
                      {pluralDe(
                        overdueTodos,
                        "überfällige Aufgabe",
                        "überfällige Aufgaben",
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sofort erledigen
                    </p>
                  </div>
                </li>
              ) : null}
              {openTodos > 0 ? (
                <li className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/70 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <ListChecks className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">
                      {openTodos}{" "}
                      {pluralDe(openTodos, "offene Aufgabe", "offene Aufgaben")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {capturesToday > 0
                        ? `${capturesToday} heute erfasst`
                        : "Noch nichts heute erfasst"}
                    </p>
                  </div>
                </li>
              ) : null}
            </ul>
          )}
        </div>
        <div className="border-t border-border/50 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <Button
            render={
              <AppNavLink
                href={APP_ROUTES.checklisten.root}
                onClick={() => onOpenChange(false)}
              />
            }
            className={cn("h-12 w-full", brandActionButtonRoundedClassName)}
          >
            Zu Aufgaben öffnen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
