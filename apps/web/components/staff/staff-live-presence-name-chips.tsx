"use client";

import type { RestaurantStaffRow, StaffLivePresenceRow } from "@/lib/types/staff";
import { staffDisplayName, STAFF_WORK_ENTRY_COLORS } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

type StaffLivePresenceNameChipsProps = {
  presence: StaffLivePresenceRow[];
  staffById: ReadonlyMap<string, RestaurantStaffRow>;
  mode: "working" | "on_break";
  className?: string;
};

export function StaffLivePresenceNameChips({
  presence,
  staffById,
  mode,
  className,
}: StaffLivePresenceNameChipsProps) {
  const members = presence
    .filter((row) => row.status === mode)
    .map((row) => staffById.get(row.staff_id))
    .filter(Boolean);

  if (members.length === 0) return null;

  const isWorking = mode === "working";

  return (
    <ul
      className={cn("flex flex-wrap gap-1", className)}
      aria-label={isWorking ? "Eingeloggt" : "In Pause"}
    >
      {members.map((member) => {
        const name = staffDisplayName(member!);
        return (
          <li
            key={member!.id}
            title={name}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none",
              isWorking
                ? "border-green-500/35 bg-green-500/12 text-green-900 dark:text-green-200"
                : "border-blue-500/35 bg-blue-500/12 text-blue-900 dark:text-blue-200",
            )}
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                backgroundColor: isWorking
                  ? STAFF_WORK_ENTRY_COLORS.work
                  : STAFF_WORK_ENTRY_COLORS.break,
              }}
              aria-hidden
            />
            <span className="max-w-[8.5rem] truncate">{name}</span>
          </li>
        );
      })}
    </ul>
  );
}
