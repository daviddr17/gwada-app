import type { SearchableSelectOption } from "@/components/ui/combobox";

export type DisplayPopupOptionId =
  | "pin_login"
  | "clock_in"
  | "break_start"
  | "break_end"
  | "clock_out"
  | "require_defer"
  | "blocks_shift_end"
  | "allow_reopen";

export type DisplayPopupFlags = {
  showOnPinLogin: boolean;
  showBeforeClockIn: boolean;
  showBeforeBreakStart: boolean;
  showBeforeBreakEnd: boolean;
  showBeforeClockOut: boolean;
  requireDeferReason: boolean;
  blocksShiftEnd: boolean;
  allowReopenOnDisplay?: boolean;
};

export function buildDisplayPopupOptions(input?: {
  includeAllowReopen?: boolean;
  blocksShiftEndLabel?: string;
}): SearchableSelectOption[] {
  const blocksLabel =
    input?.blocksShiftEndLabel ?? "Schichtende blockieren bis erfasst";
  const options: SearchableSelectOption[] = [
    { value: "pin_login", label: "Bei PIN-Anmeldung" },
    { value: "clock_in", label: "Vor Schichtbeginn" },
    { value: "break_start", label: "Vor Pausenbeginn" },
    { value: "break_end", label: "Vor Pausenende" },
    { value: "clock_out", label: "Vor Schichtende" },
    { value: "require_defer", label: "Grund bei Verschieben erforderlich" },
    { value: "blocks_shift_end", label: blocksLabel },
  ];
  if (input?.includeAllowReopen) {
    options.push({
      value: "allow_reopen",
      label: "Erledigung am Display rückgängig machen",
    });
  }
  return options;
}

export function displayPopupFlagsToIds(flags: DisplayPopupFlags): DisplayPopupOptionId[] {
  const ids: DisplayPopupOptionId[] = [];
  if (flags.showOnPinLogin) ids.push("pin_login");
  if (flags.showBeforeClockIn) ids.push("clock_in");
  if (flags.showBeforeBreakStart) ids.push("break_start");
  if (flags.showBeforeBreakEnd) ids.push("break_end");
  if (flags.showBeforeClockOut) ids.push("clock_out");
  if (flags.requireDeferReason) ids.push("require_defer");
  if (flags.blocksShiftEnd) ids.push("blocks_shift_end");
  if (flags.allowReopenOnDisplay) ids.push("allow_reopen");
  return ids;
}

export function displayPopupIdsToFlags(
  ids: readonly string[],
  prev: DisplayPopupFlags,
): DisplayPopupFlags {
  const set = new Set(ids);
  return {
    ...prev,
    showOnPinLogin: set.has("pin_login"),
    showBeforeClockIn: set.has("clock_in"),
    showBeforeBreakStart: set.has("break_start"),
    showBeforeBreakEnd: set.has("break_end"),
    showBeforeClockOut: set.has("clock_out"),
    requireDeferReason: set.has("require_defer"),
    blocksShiftEnd: set.has("blocks_shift_end"),
    allowReopenOnDisplay: set.has("allow_reopen"),
  };
}

export function displayPopupHasTrigger(flags: DisplayPopupFlags): boolean {
  return (
    flags.showOnPinLogin ||
    flags.showBeforeClockIn ||
    flags.showBeforeBreakStart ||
    flags.showBeforeBreakEnd ||
    flags.showBeforeClockOut
  );
}
