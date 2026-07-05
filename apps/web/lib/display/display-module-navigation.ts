import type { DisplayModule } from "@/lib/display/display-types";

type DisplayModuleSessionSlice = {
  modules: DisplayModule[];
  can_switch_modules: boolean;
};

/** Modul-Auswahl-Grid nur bei mehreren Modulen und Wechsel-Recht. */
export function shouldShowDisplayModulePicker(
  session: DisplayModuleSessionSlice,
): boolean {
  return session.modules.length > 1 && session.can_switch_modules;
}

/** Ein Modul oder kein Wechsel → direkt ins (erste) Modul, kein Picker. */
export function shouldAutoEnterDisplayModule(
  session: DisplayModuleSessionSlice,
): boolean {
  return session.modules.length > 0 && !shouldShowDisplayModulePicker(session);
}

export function getAutoDisplayModule(
  session: DisplayModuleSessionSlice,
): DisplayModule | null {
  if (!shouldAutoEnterDisplayModule(session)) return null;
  return session.modules[0] ?? null;
}

export function resolveDisplayActiveModule(
  session: DisplayModuleSessionSlice,
  activeModule: DisplayModule | null,
): DisplayModule | null {
  const auto = getAutoDisplayModule(session);
  if (auto) return auto;
  if (activeModule && session.modules.includes(activeModule)) {
    return activeModule;
  }
  return null;
}
