export async function deleteRestaurantPositionClient(params: {
  restaurantId: string;
  positionId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch("/api/restaurant/positions/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok) return { error: body.error ?? `delete_${res.status}` };
  return { ok: true };
}
