export async function fetchDashboardSummaryClient<T>(
  path: string,
  restaurantId: string,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(
      `${path}?${new URLSearchParams({ restaurantId })}`,
      { cache: "no-store", credentials: "include" },
    );
    const body = (await res.json()) as { data?: T; error?: string };
    if (!res.ok) {
      return { data: null, error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? null, error: null };
  } catch {
    return { data: null, error: "network_error" };
  }
}
