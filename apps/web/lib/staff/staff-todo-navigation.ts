import { APP_ROUTES } from "@/lib/navigation/app-routes";

/**
 * Deep-Link zur Aufgaben-Übersicht.
 * Wichtig: `/checklisten/todos` redirected ohne Query — deshalb immer Root nutzen.
 */
export function staffTodosPageUrl(staffId?: string | null): string {
  if (!staffId) return APP_ROUTES.checklisten.root;
  const params = new URLSearchParams({ staff: staffId });
  return `${APP_ROUTES.checklisten.root}?${params.toString()}`;
}
