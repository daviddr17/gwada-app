import {
  fiskalyProvisionOutcomeLabel,
  germanFiskalyProvisionError,
} from "@/lib/pos/fiskaly-error-messages";
import type {
  FiskalyBulkProvisionResult,
  FiskalyProvisionLocation,
  FiskalyProvisionResult,
  FiskalyProvisionStats,
  FiskalyReconcilePreview,
} from "@/lib/pos/fiskaly-provision-types";

export type {
  FiskalyBulkProvisionResult,
  FiskalyProvisionLocation,
  FiskalyProvisionResult,
  FiskalyProvisionStats,
  FiskalyReconcilePreview,
};

export type FiskalyProvisionOverview = FiskalyProvisionStats & {
  locations: FiskalyProvisionLocation[];
};

export function formatFiskalyProvisionResultLine(
  result: FiskalyProvisionResult,
  locationName?: string,
): string {
  const label = locationName ?? result.restaurantId;
  if (result.ok) {
    return `${label}: ${fiskalyProvisionOutcomeLabel(result.outcome)}`;
  }
  return `${label}: ${result.errorLabel}`;
}

export async function fetchFiskalyProvisionOverview(options?: {
  checkRemote?: boolean;
}): Promise<{
  overview: FiskalyProvisionOverview | null;
  error: string | null;
}> {
  const qs = options?.checkRemote ? "?checkRemote=1" : "";
  const res = await fetch(`/api/superadmin/fiskaly/provision-restaurants${qs}`, {
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as FiskalyProvisionOverview & {
    error?: string;
  };

  if (!res.ok) {
    return { overview: null, error: body.error ?? "Laden fehlgeschlagen" };
  }

  return { overview: body, error: null };
}

/** @deprecated Use fetchFiskalyProvisionOverview */
export async function fetchFiskalyProvisionStats(): Promise<{
  stats: FiskalyProvisionStats | null;
  error: string | null;
}> {
  const { overview, error } = await fetchFiskalyProvisionOverview();
  if (!overview) return { stats: null, error };
  const { locations: _l, ...stats } = overview;
  return { stats, error: null };
}

export async function provisionFiskalyRestaurants(
  restaurantIds?: string[],
): Promise<{
  result: FiskalyBulkProvisionResult | null;
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/fiskaly/provision-restaurants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      restaurantIds?.length ? { restaurantIds } : {},
    ),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as FiskalyBulkProvisionResult & {
    error?: string;
  };

  if (!res.ok) {
    return { result: null, error: body.error ?? "Provisionierung fehlgeschlagen" };
  }

  return { result: body, error: null };
}

export async function provisionAllFiskalyRestaurants(): Promise<{
  result: FiskalyBulkProvisionResult | null;
  error: string | null;
}> {
  return provisionFiskalyRestaurants();
}

export async function previewFiskalyReconcileRestaurant(
  restaurantId: string,
): Promise<{ preview: FiskalyReconcilePreview | null; error: string | null }> {
  const res = await fetch("/api/superadmin/fiskaly/reconcile-restaurant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, confirm: false }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as FiskalyReconcilePreview & {
    error?: string;
    errorLabel?: string;
  };

  if (!res.ok) {
    return {
      preview: null,
      error: body.errorLabel ?? germanFiskalyProvisionError(body.error),
    };
  }

  return { preview: body, error: null };
}

export async function confirmFiskalyReconcileRestaurant(
  restaurantId: string,
  match: NonNullable<FiskalyReconcilePreview["match"]>,
): Promise<{ ok: boolean; error: string | null; outcomeLabel?: string }> {
  const res = await fetch("/api/superadmin/fiskaly/reconcile-restaurant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId,
      confirm: true,
      tssId: match.tssId,
      clientId: match.clientId,
      clientSerial: match.clientSerial,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    outcomeLabel?: string;
    error?: string;
    errorLabel?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.errorLabel ?? germanFiskalyProvisionError(body.error),
    };
  }

  return { ok: true, error: null, outcomeLabel: body.outcomeLabel };
}
