import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";
import { cn } from "@/lib/utils";

const displayTodoFooterTriggerUrgencyClassName: Record<
  StaffTodoDisplayUrgency,
  string
> = {
  green:
    "border-emerald-500/30 bg-emerald-500/10 ring-emerald-500/10 hover:bg-emerald-500/16",
  orange:
    "border-amber-500/35 bg-amber-500/10 ring-amber-500/12 hover:bg-amber-500/16",
  red: "border-red-500/35 bg-red-500/10 ring-red-500/12 hover:bg-red-500/16",
};

const displayTodoFooterIconUrgencyClassName: Record<
  StaffTodoDisplayUrgency,
  string
> = {
  green: "text-emerald-600 dark:text-emerald-400",
  orange: "text-amber-600 dark:text-amber-500",
  red: "text-red-600 dark:text-red-400",
};

const displayTodoFooterCountUrgencyClassName: Record<
  StaffTodoDisplayUrgency,
  string
> = {
  green: "bg-emerald-600 text-white dark:bg-emerald-500",
  orange: "bg-amber-600 text-white dark:bg-amber-500",
  red: "bg-red-600 text-white dark:bg-red-500",
};

/** Display-Fußzeile: tappbarer ToDo-Chip (Icon + Label + Count-Pill). */
export function displayTodoFooterTriggerClassName(
  urgency: StaffTodoDisplayUrgency,
): string {
  return cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 shadow-sm ring-1",
    "transition-[background-color,transform] active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    urgency === "green" && "focus-visible:ring-emerald-500/45",
    urgency === "orange" && "focus-visible:ring-amber-500/45",
    urgency === "red" && "focus-visible:ring-red-500/45",
    displayTodoFooterTriggerUrgencyClassName[urgency],
  );
}

export function displayTodoFooterIconClassName(
  urgency: StaffTodoDisplayUrgency,
): string {
  return cn("size-3.5 shrink-0", displayTodoFooterIconUrgencyClassName[urgency]);
}

export function displayTodoFooterCountClassName(
  urgency: StaffTodoDisplayUrgency,
): string {
  return cn(
    "flex size-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-0.5 text-[10px] font-semibold leading-none",
    displayTodoFooterCountUrgencyClassName[urgency],
  );
}
