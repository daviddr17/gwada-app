import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

/** Erster Untermenü-Einstieg (Modul-„Start“), z. B. Übersicht. */
export function moduleHomeHref(items: readonly ModuleSubnavItem[]): string {
  const withRoot = items.find((i) => i.activeWhen && i.activeWhen.length > 0);
  return withRoot?.href ?? items[0]?.href ?? "/dashboard";
}

/** Gemeinsames URL-Präfix des Moduls, z. B. `/dashboard/kontakte`. */
export function modulePrefixFromSubnav(
  items: readonly ModuleSubnavItem[],
): string | null {
  const withRoot = items.find((i) => i.activeWhen && i.activeWhen.length > 0);
  if (withRoot?.activeWhen?.[0]) {
    return normalizePath(withRoot.activeWhen[0]);
  }

  const home = moduleHomeHref(items);
  const parts = normalizePath(home).split("/").filter(Boolean);
  if (parts[0] === "dashboard" && parts.length >= 2) {
    return `/dashboard/${parts[1]}`;
  }
  if (parts.length >= 1) {
    return `/${parts[0]}`;
  }
  return null;
}

function stackKey(prefix: string): string {
  return `gwada:module-nav:${prefix}`;
}

function readStack(prefix: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(stackKey(prefix));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

function writeStack(prefix: string, stack: string[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(stackKey(prefix), JSON.stringify(stack.slice(-30)));
  } catch {
    /* Private mode / Quota */
  }
}

/** Pfad in der Modul-Historie merken (nur innerhalb desselben Präfixes). */
export function recordModuleNavPath(
  prefix: string,
  pathname: string,
): void {
  const path = normalizePath(pathname);
  if (!path.startsWith(prefix)) return;

  const stack = readStack(prefix);
  if (stack[stack.length - 1] === path) return;

  stack.push(path);
  writeStack(prefix, stack);
}

/** Lesendes Zurück-Ziel für `<Link href>` — ohne Session-Stack zu mutieren. */
export function peekModuleSubnavBackTarget(
  items: readonly ModuleSubnavItem[],
  pathname: string,
): string {
  const home = normalizePath(moduleHomeHref(items));
  const current = normalizePath(pathname);
  const prefix = modulePrefixFromSubnav(items);

  if (!prefix || !current.startsWith(prefix)) {
    return home;
  }

  if (current === home) {
    return "/dashboard";
  }

  const stack = readStack(prefix);
  let working = [...stack];

  if (working[working.length - 1] === current) {
    working.pop();
  }

  const previous = working[working.length - 1];
  if (previous && previous.startsWith(prefix) && previous !== current) {
    return previous;
  }

  return home;
}

/** Session-Stack nach Zurück-Navigation per Link anpassen. */
export function applyModuleSubnavBackStack(
  items: readonly ModuleSubnavItem[],
  pathname: string,
): void {
  const home = normalizePath(moduleHomeHref(items));
  const current = normalizePath(pathname);
  const prefix = modulePrefixFromSubnav(items);

  if (!prefix || !current.startsWith(prefix) || current === home) {
    return;
  }

  const stack = readStack(prefix);
  let working = [...stack];

  if (working[working.length - 1] === current) {
    working.pop();
  }

  const previous = working[working.length - 1];
  if (previous && previous.startsWith(prefix) && previous !== current) {
    writeStack(prefix, working);
    return;
  }

  writeStack(prefix, [home]);
}

/**
 * Ziel für den Zurück-Pfeil im Untermenü — keine `history.back()` (Login/OAuth/extern).
 * @deprecated Prefer `peekModuleSubnavBackTarget` + native `<Link>`.
 */
export function resolveModuleSubnavBackTarget(
  items: readonly ModuleSubnavItem[],
  pathname: string,
): string {
  applyModuleSubnavBackStack(items, pathname);
  return peekModuleSubnavBackTarget(items, pathname);
}
