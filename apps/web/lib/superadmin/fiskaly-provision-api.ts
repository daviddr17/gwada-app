export type FiskalyProvisionStats = {
  totalRestaurants: number;
  ready: number;
  failed: number;
  pending: number;
  cashRegisterReady: number;
  cashRegisterMissing: number;
};

export type FiskalyBulkProvisionResult = {
  total: number;
  ready: number;
  failed: number;
};

export async function fetchFiskalyProvisionStats(): Promise<{
  stats: FiskalyProvisionStats | null;
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/fiskaly/provision-restaurants", {
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as FiskalyProvisionStats & {
    error?: string;
  };

  if (!res.ok) {
    return { stats: null, error: body.error ?? "Laden fehlgeschlagen" };
  }

  return { stats: body, error: null };
}

export async function provisionAllFiskalyRestaurants(): Promise<{
  result: FiskalyBulkProvisionResult | null;
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/fiskaly/provision-restaurants", {
    method: "POST",
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as FiskalyBulkProvisionResult & {
    error?: string;
  };

  if (!res.ok) {
    return { result: null, error: body.error ?? "Provisionierung fehlgeschlagen" };
  }

  return {
    result: {
      total: body.total,
      ready: body.ready,
      failed: body.failed,
    },
    error: null,
  };
}
