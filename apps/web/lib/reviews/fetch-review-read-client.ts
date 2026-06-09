import type { ReviewPlatform } from "@/lib/constants/review-platforms";

export async function markReviewReadClient(params: {
  restaurantId: string;
  platform: ReviewPlatform;
  reviewId: string;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/reviews/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      return { ok: false, error: json.error ?? "mark_read_failed" };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function markReviewUnreadClient(params: {
  restaurantId: string;
  platform: ReviewPlatform;
  reviewId: string;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/reviews/unread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      return { ok: false, error: json.error ?? "mark_unread_failed" };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function markAllReviewsReadClient(
  restaurantId: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/reviews/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      return { ok: false, error: json.error ?? "mark_all_read_failed" };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function markReviewReadBatchClient(params: {
  restaurantId: string;
  items: readonly { platform: ReviewPlatform; reviewId: string }[];
}): Promise<{ ok: boolean; error: string | null }> {
  if (params.items.length === 0) {
    return { ok: true, error: null };
  }
  try {
    const res = await fetch("/api/reviews/read-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: params.restaurantId,
        items: params.items,
      }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      return { ok: false, error: json.error ?? "mark_batch_read_failed" };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
