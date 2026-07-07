import { APP_ROUTES } from "@/lib/navigation/app-routes";

export function staffWorkHoursPageUrl(staffId?: string | null): string {
  if (!staffId) return APP_ROUTES.mitarbeiter.hours;
  const params = new URLSearchParams({ staff: staffId });
  return `${APP_ROUTES.mitarbeiter.hours}?${params.toString()}`;
}
