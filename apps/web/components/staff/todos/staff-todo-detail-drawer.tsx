"use client";

import { Check, Pencil, RotateCcw } from "lucide-react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { staffTodoAssigneeLabel } from "@/lib/supabase/staff-todos-db";
import {
  formatStaffTodoStatusLabel,
  staffTodoAssigneeCount,
  staffTodoCanReopen,
} from "@/lib/staff/staff-todo-completion-display";
import {
  computeStaffTodoStatus,
  staffTodoPriorityBadgeClass,
  staffTodoStatusBadgeClass,
  STAFF_TODO_STATUS_LABELS,
} from "@/lib/staff/staff-todo-status";
import {
  staffTodoCaptureLabel,
  staffTodoContextLabel,
  staffTodoLimitsLabel,
  staffTodoRecurrenceLabel,
} from "@/lib/staff/staff-todo-meta";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { STAFF_TODO_PRIORITY_LABELS } from "@/lib/types/staff-todos";
import type { RestaurantStaffTodoRow } from "@/lib/types/staff-todos";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

type StaffTodoDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: RestaurantStaffTodoRow | null;
  restaurantTimezone: string;
  staffList: readonly RestaurantStaffRow[];
  canUpdate: boolean;
  busy?: boolean;
  onMarkDone: (todo: RestaurantStaffTodoRow) => void | Promise<void>;
  onReopen: (todo: RestaurantStaffTodoRow) => void | Promise<void>;
  onEdit: (todo: RestaurantStaffTodoRow) => void;
};

export function StaffTodoDetailDrawer({
  open,
  onOpenChange,
  todo,
  restaurantTimezone,
  staffList,
  canUpdate,
  busy = false,
  onMarkDone,
  onReopen,
  onEdit,
}: StaffTodoDetailDrawerProps) {
  const staffById = new Map(staffList.map((s) => [s.id, s] as const));

  if (!todo) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className={drawerContentClassName("wide")} />
      </Drawer>
    );
  }

  const assigneeCount = staffTodoAssigneeCount(todo);
  const status = computeStaffTodoStatus(
    todo,
    todo.completions,
    assigneeCount,
    new Date(),
    restaurantTimezone,
  );
  const statusDetail = formatStaffTodoStatusLabel(
    todo,
    restaurantTimezone,
    staffById,
  );
  const canMarkDone =
    canUpdate && status !== "done" && status !== "archived" && status !== "planned";
  const canReopen =
    canUpdate && staffTodoCanReopen(todo, restaurantTimezone);
  const recurrence = staffTodoRecurrenceLabel(todo.recurrence);
  const limits = staffTodoLimitsLabel(todo);
  const context = staffTodoContextLabel(todo);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("wide")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {todo.title}
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            Status und Erledigung — {staffTodoAssigneeLabel(todo)}
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName("4-6")}>
          <DrawerFormSection contentPadding="4-6" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={staffTodoPriorityBadgeClass(todo.priority)}
              >
                {STAFF_TODO_PRIORITY_LABELS[todo.priority]}
              </Badge>
              <Badge variant="outline" className={staffTodoStatusBadgeClass(status)}>
                {STAFF_TODO_STATUS_LABELS[status]}
              </Badge>
              {recurrence ? (
                <Badge variant="outline" className="border-border/60">
                  {recurrence}
                </Badge>
              ) : null}
            </div>

            {todo.description ? (
              <p className="text-sm text-muted-foreground">{todo.description}</p>
            ) : null}

            <dl className="grid gap-2 text-sm">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-right font-medium">{statusDetail}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Erfassung</dt>
                <dd>{staffTodoCaptureLabel(todo.capture_type)}</dd>
              </div>
              {limits ? (
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Grenzwerte</dt>
                  <dd>{limits}</dd>
                </div>
              ) : null}
              {context ? (
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Kontext</dt>
                  <dd>{context}</dd>
                </div>
              ) : null}
            </dl>

            {canUpdate ? (
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                {canMarkDone ? (
                  <Button
                    type="button"
                    className={cn("flex-1 gap-2", brandActionButtonRoundedClassName)}
                    disabled={busy}
                    onClick={() => void onMarkDone(todo)}
                  >
                    <Check className="size-4" />
                    Als erledigt markieren
                  </Button>
                ) : null}
                {canReopen ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-2 rounded-xl"
                    disabled={busy}
                    onClick={() => void onReopen(todo)}
                  >
                    <RotateCcw className="size-4" />
                    Nicht erledigt
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2 rounded-xl"
                  disabled={busy}
                  onClick={() => onEdit(todo)}
                >
                  <Pencil className="size-4" />
                  Bearbeiten
                </Button>
              </div>
            ) : null}
          </DrawerFormSection>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
