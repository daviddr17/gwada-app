export type RestaurantFiscalSignatureRow = {
  id: string;
  orderId: string;
  orderNumber: number | null;
  txId: string;
  tssId: string;
  clientId: string;
  signature: string;
  signatureCounter: number;
  signedAt: string | null;
  receiptPublicUrl: string | null;
  state: string;
};

export type RestaurantFiscalOverview = {
  configured: boolean;
  fiskalyEnabled: boolean;
  provisionStatus: "pending" | "ready" | "failed" | null;
  provisionError: string | null;
  provisionedAt: string | null;
  tssId: string | null;
  clientId: string | null;
  clientSerial: string | null;
  dsfinvkCashRegisterReady: boolean;
  registerOpenedAt: string | null;
  lastClosingAt: string | null;
  lastClosingZNr: number | null;
  platformEnabled: boolean;
  platformEnv: "TEST" | "LIVE" | null;
  recentSignatures: RestaurantFiscalSignatureRow[];
};
