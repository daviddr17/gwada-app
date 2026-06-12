export async function triggerMetaReaction(params: {
  restaurantId: string;
  platform: "facebook" | "instagram";
  messageId: string;
  reaction: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/contact-messages/meta/reaction", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
