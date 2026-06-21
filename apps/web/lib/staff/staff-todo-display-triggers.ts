import type { StaffTodoDeferTrigger } from "@/lib/types/staff-todos";

export function displayActionToTrigger(
  action: "clock_in" | "start_break" | "end_break" | "clock_out",
): StaffTodoDeferTrigger {
  switch (action) {
    case "start_break":
      return "break_start";
    case "end_break":
      return "break_end";
    default:
      return action;
  }
}

export function triggerShowColumn(
  trigger: StaffTodoDeferTrigger,
):
  | "show_before_clock_in"
  | "show_before_break_start"
  | "show_before_break_end"
  | "show_before_clock_out"
  | "show_on_pin_login" {
  switch (trigger) {
    case "clock_in":
      return "show_before_clock_in";
    case "break_start":
      return "show_before_break_start";
    case "break_end":
      return "show_before_break_end";
    case "clock_out":
      return "show_before_clock_out";
    default:
      return "show_on_pin_login";
  }
}
