"use client";

import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaffRoleAccessIcons } from "@/components/staff/staff-role-access-icons";
import {
  staffPresenceStatusForRow,
  STAFF_PRESENCE_STATUS_LABELS,
} from "@/lib/staff/staff-presence-labels";
import { formatRestaurantPositionLabel } from "@/lib/restaurant/format-restaurant-position-label";
import { normalizeRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";
import { EMPLOYEE_ROLE_OPTIONS } from "@/lib/types/employee-role";
import {
  staffFamilyFirstDisplayName,
  type RestaurantStaffRow,
} from "@/lib/types/staff";
import { TagColorStripe } from "@/lib/ui/tag-color-stripe";

function staffRoleDisplay(row: RestaurantStaffRow): {
  label: string;
  color?: string;
} | null {
  const position =
    row.restaurant_position ?? row.linked_employee?.restaurant_position;
  if (position) {
    return {
      label: formatRestaurantPositionLabel(position),
      color: normalizeRestaurantPositionColor(undefined, position.id),
    };
  }
  const role = row.linked_employee?.role;
  if (!role) return null;
  return {
    label: EMPLOYEE_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role,
  };
}

export type StaffOverviewMobileListProps = {
  rows: RestaurantStaffRow[];
  emptyMessage: string;
  workingIds: Set<string>;
  breakIds: Set<string>;
  onEdit: (row: RestaurantStaffRow) => void;
};

/** Mobile-only: Mitarbeiter als Karten ohne Quer-Scroll. */
export function StaffOverviewMobileList({
  rows,
  emptyMessage,
  workingIds,
  breakIds,
  onEdit,
}: StaffOverviewMobileListProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border/50 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const tag = row.position_tag;
        const role = staffRoleDisplay(row);
        const presenceStatus = staffPresenceStatusForRow(
          row.id,
          workingIds,
          breakIds,
        );
        const presenceLabel = STAFF_PRESENCE_STATUS_LABELS[presenceStatus];
        const contact = row.email ?? row.phone ?? null;

        return (
          <li
            key={row.id}
            className="rounded-2xl border border-border/50 bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
                onClick={() => onEdit(row)}
                aria-label={`${staffFamilyFirstDisplayName(row)} bearbeiten`}
              >
                <p className="truncate text-base font-semibold leading-snug">
                  {staffFamilyFirstDisplayName(row)}
                </p>

                {tag || role ? (
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {tag ? (
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium leading-none">
                        <span
                          className="size-2.5 shrink-0 rounded-full border border-border/50"
                          style={{ backgroundColor: tag.background_color }}
                          aria-hidden
                        />
                        <span className="truncate">{tag.name}</span>
                      </span>
                    ) : null}
                    {tag && role ? (
                      <span
                        className="text-muted-foreground/50"
                        aria-hidden
                      >
                        ·
                      </span>
                    ) : null}
                    {role ? (
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium leading-none text-muted-foreground">
                        {role.color ? (
                          <TagColorStripe
                            color={role.color}
                            className="mr-0 h-3.5 shrink-0 self-center"
                          />
                        ) : null}
                        <span className="truncate">{role.label}</span>
                        <StaffRoleAccessIcons
                          profile_id={row.profile_id}
                          linked_profile={row.linked_profile}
                          linked_employee={row.linked_employee}
                          display_pin_set_at={row.display_pin_set_at}
                          className="self-center"
                        />
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {contact ? (
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">
                    {contact}
                  </p>
                ) : null}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {row.is_active ? (
                    <Badge variant="secondary">Aktiv</Badge>
                  ) : (
                    <Badge variant="outline">Inaktiv</Badge>
                  )}
                  {presenceStatus !== "off" ? (
                    <Badge
                      variant={
                        presenceStatus === "on_break" ? "outline" : "default"
                      }
                    >
                      {presenceLabel}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tippen zum Bearbeiten
                </p>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full text-muted-foreground"
                aria-label="Bearbeiten"
                onClick={() => onEdit(row)}
              >
                <Pencil className="size-4" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
