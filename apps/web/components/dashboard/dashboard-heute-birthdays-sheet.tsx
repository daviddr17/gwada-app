"use client";

import { Cake } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { StaffBirthdayToday } from "@/lib/staff/staff-birthdays-today";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";

export function DashboardHeuteBirthdaysSheet({
  open,
  onOpenChange,
  birthdays,
  dayLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birthdays: StaffBirthdayToday[];
  dayLabel: string;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Geburtstage
          </DrawerTitle>
          <DrawerDescription>{dayLabel}</DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {birthdays.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Heute hat niemand aus dem Team Geburtstag.
            </p>
          ) : (
            <ul className="space-y-2">
              {birthdays.map((row) => (
                <li
                  key={row.staffId}
                  className="flex items-center gap-3 rounded-xl border border-pink-500/25 bg-pink-500/8 px-4 py-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-300">
                    <Cake className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.age != null
                        ? `wird heute ${row.age} Jahre`
                        : "hat heute Geburtstag"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
