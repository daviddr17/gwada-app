"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import type {
  RestaurantStaffRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import { staffDisplayName } from "@/lib/types/staff";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

export type StaffLivePresenceSheetMode = "working" | "on_break";

function presenceTimeLabel(row: StaffLivePresenceRow): string {
  if (row.status === "on_break" && row.break_started_at) {
    return `Pause seit ${timeFmt.format(new Date(row.break_started_at))}`;
  }
  return `Schicht seit ${timeFmt.format(new Date(row.clocked_in_at))}`;
}

const SHEET_COPY: Record<
  StaffLivePresenceSheetMode,
  { title: string; empty: string }
> = {
  working: {
    title: "Gerade in Schicht",
    empty: "Niemand ist gerade eingestempelt.",
  },
  on_break: {
    title: "In Pause",
    empty: "Niemand ist gerade in Pause.",
  },
};

export function StaffOverviewLivePresenceSheet({
  open,
  onOpenChange,
  mode,
  presence,
  staffById,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: StaffLivePresenceSheetMode;
  presence: StaffLivePresenceRow[];
  staffById: Map<string, RestaurantStaffRow>;
}) {
  const copy = SHEET_COPY[mode];
  const rows = presence
    .filter((p) => p.status === mode)
    .map((p) => {
      const staff = staffById.get(p.staff_id);
      return {
        ...p,
        name: staff ? staffDisplayName(staff) : "Unbekannt",
        positionTag: staff?.position_tag?.name ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {copy.title}
          </DrawerTitle>
          <DrawerDescription>Live vom Display</DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {copy.empty}
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.staff_id}
                  className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/15 px-4 py-3"
                >
                  <StaffWorkEntryTypeStripe
                    type={mode === "on_break" ? "break" : "work"}
                    className="mt-0.5 self-stretch"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{row.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.positionTag ? `${row.positionTag} · ` : ""}
                      {presenceTimeLabel(row)}
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
