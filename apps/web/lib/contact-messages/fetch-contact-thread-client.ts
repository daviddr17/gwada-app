import type { ContactThreadContactMeta } from "@/lib/contact-messages/fetch-contact-thread-server";
import { CONTACT_THREAD_PAGE_SIZE } from "@/lib/contact-messages/contact-thread-pagination";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export type ContactThreadPageClientResult = {
  data: ContactMessageRow[];
  hasMore: boolean;
  oldestCursor: string | null;
  contact: ContactThreadContactMeta | null;
  error: string | null;
};

export async function fetchContactThreadPageClient(params: {
  restaurantId: string;
  contactId: string;
  limit?: number;
  before?: string | null;
}): Promise<ContactThreadPageClientResult> {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    limit: String(params.limit ?? CONTACT_THREAD_PAGE_SIZE),
  });
  if (params.before) {
    q.set("before", params.before);
  }

  try {
    const res = await fetch(`/api/contact-messages/thread?${q}`);
    const body = (await res.json()) as {
      data?: ContactMessageRow[];
      hasMore?: boolean;
      oldestCursor?: string | null;
      contact?: ContactThreadContactMeta | null;
      error?: string | null;
    };

    if (!res.ok) {
      return {
        data: [],
        hasMore: false,
        oldestCursor: null,
        contact: body.contact ?? null,
        error: body.error ?? `http_${res.status}`,
      };
    }

    return {
      data: body.data ?? [],
      hasMore: Boolean(body.hasMore),
      oldestCursor: body.oldestCursor ?? null,
      contact: body.contact ?? null,
      error: null,
    };
  } catch {
    return {
      data: [],
      hasMore: false,
      oldestCursor: null,
      contact: null,
      error: "network_error",
    };
  }
}
