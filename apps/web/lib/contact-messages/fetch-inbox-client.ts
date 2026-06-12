import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { dispatchDashboardMessagesRefresh } from "@/lib/dashboard/dashboard-live-events";
import type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export async function fetchWahaConversationsClient(
  restaurantId: string,
): Promise<{ data: ContactConversationPreview[]; error: string | null }> {
  try {
    const res = await fetch(
      `/api/contact-messages/waha/conversations?${new URLSearchParams({ restaurantId })}`,
    );
    const body = (await res.json()) as {
      data?: ContactConversationPreview[];
      error?: string;
    };
    if (!res.ok) {
      return { data: [], error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? [], error: null };
  } catch {
    return { data: [], error: "network_error" };
  }
}

export async function fetchMetaConversationsClient(
  restaurantId: string,
  platform: "facebook" | "instagram",
): Promise<{ data: ContactConversationPreview[]; error: string | null }> {
  try {
    const q = new URLSearchParams({ restaurantId, platform });
    const res = await fetch(`/api/contact-messages/meta/conversations?${q}`);
    const body = (await res.json()) as {
      data?: ContactConversationPreview[];
      error?: string;
    };
    if (!res.ok) {
      return { data: [], error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? [], error: null };
  } catch {
    return { data: [], error: "network_error" };
  }
}

export async function fetchMetaMessagesClient(params: {
  restaurantId: string;
  contactId: string;
}): Promise<{ data: ContactMessageRow[]; error: string | null }> {
  try {
    const q = new URLSearchParams({
      restaurantId: params.restaurantId,
      contactId: params.contactId,
    });
    const res = await fetch(`/api/contact-messages/meta/messages?${q}`);
    const body = (await res.json()) as {
      data?: ContactMessageRow[];
      error?: string;
    };
    if (!res.ok) {
      return { data: [], error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? [], error: null };
  } catch {
    return { data: [], error: "network_error" };
  }
}

export async function fetchEmailConversationsClient(
  restaurantId: string,
): Promise<{ data: ContactConversationPreview[]; error: string | null }> {
  try {
    const res = await fetch(
      `/api/contact-messages/email/conversations?${new URLSearchParams({ restaurantId })}`,
    );
    const body = (await res.json()) as {
      data?: ContactConversationPreview[];
      error?: string;
    };
    if (!res.ok) {
      return { data: [], error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? [], error: null };
  } catch {
    return { data: [], error: "network_error" };
  }
}

export async function fetchEmailMessagesClient(params: {
  restaurantId: string;
  contactId: string;
}): Promise<{ data: ContactMessageRow[]; error: string | null }> {
  try {
    const q = new URLSearchParams({
      restaurantId: params.restaurantId,
      contactId: params.contactId,
    });
    const res = await fetch(`/api/contact-messages/email/messages?${q}`);
    const body = (await res.json()) as {
      data?: ContactMessageRow[];
      error?: string;
    };
    if (!res.ok) {
      return { data: [], error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? [], error: null };
  } catch {
    return { data: [], error: "network_error" };
  }
}

export async function fetchWahaDisplayNameClient(params: {
  restaurantId: string;
  chatId: string;
}): Promise<{ displayName: string | null; error: string | null }> {
  try {
    const q = new URLSearchParams({
      restaurantId: params.restaurantId,
      chatId: params.chatId,
    });
    const res = await fetch(`/api/contact-messages/waha/display-name?${q}`);
    const body = (await res.json()) as {
      displayName?: string;
      error?: string;
    };
    if (!res.ok) {
      return { displayName: null, error: body.error ?? `http_${res.status}` };
    }
    return { displayName: body.displayName ?? null, error: null };
  } catch {
    return { displayName: null, error: "network_error" };
  }
}

export async function fetchWahaResolvedPhoneClient(params: {
  restaurantId: string;
  chatId: string;
}): Promise<{
  phoneForParse: string | null;
  lidUnresolved: boolean;
  error: string | null;
}> {
  try {
    const q = new URLSearchParams({
      restaurantId: params.restaurantId,
      chatId: params.chatId,
    });
    const res = await fetch(`/api/contact-messages/waha/resolve-phone?${q}`);
    const body = (await res.json()) as {
      phoneForParse?: string | null;
      lidUnresolved?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return {
        phoneForParse: null,
        lidUnresolved: true,
        error: body.error ?? `http_${res.status}`,
      };
    }
    return {
      phoneForParse: body.phoneForParse ?? null,
      lidUnresolved: body.lidUnresolved ?? false,
      error: null,
    };
  } catch {
    return { phoneForParse: null, lidUnresolved: true, error: "network_error" };
  }
}

export async function markConversationReadClient(params: {
  restaurantId: string;
  conversationKey: string;
  platform: ContactMessagePlatform;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/contact-messages/conversations/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? `http_${res.status}` };
    dispatchDashboardMessagesRefresh();
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function markConversationUnreadClient(params: {
  restaurantId: string;
  conversationKey: string;
  platform: ContactMessagePlatform;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/contact-messages/conversations/unread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? `http_${res.status}` };
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function fetchMessagesUnreadSummaryClient(
  restaurantId: string,
  options?: { scope?: "dashboard" | "full" },
): Promise<{ data: MessagesUnreadSummary | null; error: string | null }> {
  try {
    const q = new URLSearchParams({ restaurantId });
    if (options?.scope === "dashboard") q.set("scope", "dashboard");
    const res = await fetch(
      `/api/contact-messages/unread-summary?${q}`,
    );
    const body = (await res.json()) as {
      data?: MessagesUnreadSummary;
      error?: string;
    };
    if (!res.ok) {
      return { data: null, error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? null, error: null };
  } catch {
    return { data: null, error: "network_error" };
  }
}

export async function fetchWahaMessagesClient(params: {
  restaurantId: string;
  contactId: string;
  chatId?: string | null;
}): Promise<{ data: ContactMessageRow[]; error: string | null }> {
  try {
    const q = new URLSearchParams({
      restaurantId: params.restaurantId,
      contactId: params.contactId,
    });
    if (params.chatId) q.set("chatId", params.chatId);
    if (params.contactId.startsWith("waha:")) {
      q.set("chatId", params.contactId.slice(5));
    }
    const res = await fetch(`/api/contact-messages/waha/messages?${q}`);
    const body = (await res.json()) as {
      data?: ContactMessageRow[];
      error?: string;
    };
    if (!res.ok) {
      return { data: [], error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? [], error: null };
  } catch {
    return { data: [], error: "network_error" };
  }
}
