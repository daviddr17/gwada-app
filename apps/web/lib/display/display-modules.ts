import type { DisplayModule } from "@/lib/display/display-types";

export const DISPLAY_MODULE_PERMISSION: Record<DisplayModule, string> = {
  time: "display.time",
  reservations: "display.reservations",
  recipes: "display.recipes",
  inventory: "display.inventory",
  compliance: "display.compliance",
  kds: "display.kds",
};

/** Team-Anwesenheit in Display-Zeiterfassung (wer ist eingestempelt / in Pause). */
export const DISPLAY_TIME_PRESENCE_PERMISSION = "display.time_presence";

export function resolveStaffDisplayModules(params: {
  displayModules: DisplayModule[];
  staffPermissionKeys: string[];
}): { modules: DisplayModule[]; canSwitchModules: boolean } {
  const permSet = new Set(params.staffPermissionKeys);
  const modules = params.displayModules.filter((m) => {
    if (m === "kds") return false;
    return permSet.has(DISPLAY_MODULE_PERMISSION[m]);
  });
  const canSwitchModules =
    modules.length > 1 && permSet.has("display.module_switch");
  return { modules, canSwitchModules };
}
