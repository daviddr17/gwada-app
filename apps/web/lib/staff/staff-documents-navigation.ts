import { APP_ROUTES } from "@/lib/navigation/app-routes";

export function staffDocumentsPageUrl(staffId?: string | null): string {
  if (!staffId) return APP_ROUTES.mitarbeiter.documents;
  const params = new URLSearchParams({ staff: staffId });
  return `${APP_ROUTES.mitarbeiter.documents}?${params.toString()}`;
}
