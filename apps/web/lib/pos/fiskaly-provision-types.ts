export type FiskalyProvisionStatus = "pending" | "ready" | "failed" | null;

export type FiskalyProvisionOutcome =
  | "created"
  | "skipped_ready"
  | "linked_existing"
  | "dsfinvk_backfill"
  | "failed";

export type FiskalyRemoteClientMatch = {
  found: true;
  tssId: string;
  clientId: string;
  clientSerial: string;
  tssState?: string | null;
  clientState?: string | null;
};

export type FiskalyProvisionLocation = {
  restaurantId: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  addressLine1: string | null;
  locationLabel: string;
  provisionStatus: FiskalyProvisionStatus;
  provisionError: string | null;
  provisionErrorLabel: string | null;
  suggestReconcile: boolean;
  tssId: string | null;
  clientId: string | null;
  clientSerial: string | null;
  expectedClientSerial: string;
  dsfinvkCashRegisterReady: boolean;
  fiskalyRemote: FiskalyRemoteClientMatch | null;
};

export type FiskalyProvisionStats = {
  totalRestaurants: number;
  ready: number;
  failed: number;
  pending: number;
  cashRegisterReady: number;
  cashRegisterMissing: number;
};

export type FiskalyProvisionResultSuccess = {
  ok: true;
  restaurantId: string;
  outcome: Exclude<FiskalyProvisionOutcome, "failed">;
  tssId: string;
  clientId: string;
  clientSerial: string;
  dsfinvkCashRegisterReady?: boolean;
  suggestReconcile?: boolean;
};

export type FiskalyProvisionResultFailure = {
  ok: false;
  restaurantId: string;
  outcome: "failed";
  error: string;
  errorLabel: string;
  suggestReconcile?: boolean;
};

export type FiskalyProvisionResult =
  | FiskalyProvisionResultSuccess
  | FiskalyProvisionResultFailure;

export type FiskalyBulkProvisionResult = {
  total: number;
  ready: number;
  failed: number;
  results: FiskalyProvisionResult[];
};

export type FiskalyReconcilePreview = {
  restaurantId: string;
  restaurantName: string;
  expectedClientSerial: string;
  match: FiskalyRemoteClientMatch | null;
};
