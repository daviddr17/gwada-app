"use client";

import { Badge } from "@/components/ui/badge";
import type { DisplayTodoClient } from "@/lib/display/display-todo-client";
import { staffTodoRecurrenceLabel } from "@/lib/staff/staff-todo-meta";
import { cn } from "@/lib/utils";

type DisplayTodoContextBadgesProps = {
  todo: Pick<
    DisplayTodoClient,
    "recurrence" | "checklist_area" | "checklist_device"
  >;
  className?: string;
};

export function DisplayTodoContextBadges({
  todo,
  className,
}: DisplayTodoContextBadgesProps) {
  const recurrence = staffTodoRecurrenceLabel(todo.recurrence);
  const area = todo.checklist_area;
  const device = todo.checklist_device;

  if (!recurrence && !area && !device) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {recurrence ? (
        <Badge variant="secondary" className="rounded-lg font-normal">
          {recurrence}
        </Badge>
      ) : null}
      {area ? (
        <Badge
          variant="outline"
          className="rounded-lg border-transparent font-normal text-foreground"
          style={{ backgroundColor: `${area.background_color}33` }}
        >
          {area.name}
        </Badge>
      ) : null}
      {device ? (
        <Badge variant="outline" className="rounded-lg font-normal">
          {device.name}
        </Badge>
      ) : null}
    </div>
  );
}
