import "server-only";

export const ACCOUNTING_VOUCHERS_STORAGE_BUCKET = "accounting-vouchers";

export function buildAccountingVoucherStoragePath(params: {
  restaurantId: string;
  voucherId: string;
  fileName: string;
}): string {
  const safeName = params.fileName.replace(/[^\w.\-()+]/g, "_");
  return `${params.restaurantId}/${params.voucherId}/${safeName}`;
}
