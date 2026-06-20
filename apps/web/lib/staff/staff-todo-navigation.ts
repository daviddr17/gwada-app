import { APP_ROUTES } from "@/lib/navigation/app-routes";

export function staffTodosPageUrl(staffId?: string | null): string {
  if (!staffId) return APP_ROUTES.mitarbeiter.todos;
  const params = new URLSearchParams({ staff: staffId });
  return `${APP_ROUTES.mitarbeiter.todos}?${params.toString()}`;
}
