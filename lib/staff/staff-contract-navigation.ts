import { APP_ROUTES } from "@/lib/navigation/app-routes";

export function staffContractsPageUrl(
  staffId: string,
  contractId?: string | null,
): string {
  const params = new URLSearchParams({ staff: staffId });
  if (contractId) params.set("contract", contractId);
  return `${APP_ROUTES.mitarbeiter.contracts}?${params.toString()}`;
}
