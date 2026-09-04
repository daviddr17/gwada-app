export type PurchaseOrderCloseProgress = {
  done: number;
  total: number;
};

export function purchaseOrderCloseProgressPercent(
  progress: PurchaseOrderCloseProgress,
): number {
  if (progress.total <= 0) return 100;
  return Math.min(100, Math.round((progress.done / progress.total) * 100));
}
