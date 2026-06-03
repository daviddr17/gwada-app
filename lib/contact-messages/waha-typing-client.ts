export async function setWahaTypingClient(params: {
  restaurantId: string;
  chatId: string;
  action: "start" | "stop";
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/contact-messages/waha/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
