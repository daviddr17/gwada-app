import type { BillingPlanId } from "@/lib/billing/plan-catalog";

/** Basic / Free Fallback — Workspace-Speicher gesamt. */
export const RESTAURANT_WORKSPACE_QUOTA_BYTES_BASIC = 3 * 1024 * 1024 * 1024;

/** Pro — Workspace-Speicher gesamt. */
export const RESTAURANT_WORKSPACE_QUOTA_BYTES_PRO = 10 * 1024 * 1024 * 1024;

/**
 * Fallback wenn Plan unbekannt (z. B. RPC-Fehler).
 * @deprecated Prefer {@link workspaceQuotaBytesForPlan} or DB `restaurant_workspace_quota_bytes(uuid)`.
 */
export const RESTAURANT_WORKSPACE_QUOTA_BYTES =
  RESTAURANT_WORKSPACE_QUOTA_BYTES_BASIC;

export function workspaceQuotaBytesForPlan(
  planId: BillingPlanId | string | null | undefined,
): number {
  return planId === "pro"
    ? RESTAURANT_WORKSPACE_QUOTA_BYTES_PRO
    : RESTAURANT_WORKSPACE_QUOTA_BYTES_BASIC;
}

export type WorkspaceStorageBreakdown = {
  documentsBytes: number;
  galleryBytes: number;
  newsBytes: number;
  accountingBytes: number;
  totalBytes: number;
  quotaBytes: number;
};

export const WORKSPACE_STORAGE_MODULE_LABELS: Record<
  keyof Omit<WorkspaceStorageBreakdown, "totalBytes" | "quotaBytes">,
  string
> = {
  documentsBytes: "Dokumente",
  galleryBytes: "Galerie",
  newsBytes: "News",
  accountingBytes: "Buchführung",
};
