export async function setFeedItemPin(params: {
  restaurantId: string;
  module: "news" | "events" | "gallery" | "reviews";
  platform: string;
  itemId: string;
  pinned: boolean;
}): Promise<{ ok: true; isPinned: boolean } | { error: string }> {
  const res = await fetch("/api/feed-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    isPinned?: boolean;
    error?: string;
  };
  if (!res.ok) {
    return { error: data.error ?? "pin_failed" };
  }
  return { ok: true, isPinned: Boolean(data.isPinned) };
}
