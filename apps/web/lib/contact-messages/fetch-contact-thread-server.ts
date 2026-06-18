import "server-only";

import { fetchContactMessagesAdmin } from "@/lib/contact-messages/contact-messages-admin";
import {
  CONTACT_THREAD_PAGE_SIZE,
} from "@/lib/contact-messages/contact-thread-pagination";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { isMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import {
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { contactThreadDisplayName } from "@/lib/supabase/contacts-db";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import {
  createContactThreadTiming,
  logContactThreadTiming,
  type ContactThreadTiming,
} from "@/lib/contact-messages/contact-thread-timing";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactThreadContactMeta = {
  name: string;
  hasPhone: boolean;
  hasEmail: boolean;
  whatsappThreadChatId: string | null;
  hasFacebookId: boolean;
  hasInstagramId: boolean;
};

export type ContactThreadPageResult = {
  messages: ContactMessageRow[];
  hasMore: boolean;
  oldestCursor: string | null;
  contact: ContactThreadContactMeta | null;
  error: string | null;
  timing?: ContactThreadTiming;
};

type ContactRow = {
  first_name: string;
  last_name: string;
  contact_phones?: { phone: string }[] | { phone: string } | null;
  contact_emails?: { email: string }[] | { email: string } | null;
  contact_messaging_ids?: { platform: string; external_sender_id: string }[] | null;
};

function hasMessagingPlatform(
  rows: ContactRow["contact_messaging_ids"],
  platform: "facebook" | "instagram",
): boolean {
  const list = Array.isArray(rows) ? rows : [];
  return list.some((r) => r.platform === platform && r.external_sender_id?.trim());
}

async function loadContactRow(
  admin: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<ContactRow | null> {
  const { data } = await admin
    .from("contacts")
    .select(
      `
      first_name,
      last_name,
      contact_phones ( phone ),
      contact_emails ( email ),
      contact_messaging_ids ( platform, external_sender_id )
    `,
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", contactId)
    .maybeSingle();

  return (data as ContactRow | null) ?? null;
}

function firstPhoneFromRow(contact: ContactRow): string | null {
  const rows = Array.isArray(contact.contact_phones)
    ? contact.contact_phones
    : contact.contact_phones
      ? [contact.contact_phones]
      : [];
  return rows[0]?.phone?.trim() ?? null;
}

function firstEmailFromRow(contact: ContactRow): string | null {
  const rows = Array.isArray(contact.contact_emails)
    ? contact.contact_emails
    : contact.contact_emails
      ? [contact.contact_emails]
      : [];
  return rows[0]?.email?.trim() ?? null;
}

function contactMetaFromRow(
  contact: ContactRow | null,
  fallbackName: string,
): ContactThreadContactMeta {
  if (!contact) {
    return {
      name: fallbackName,
      hasPhone: false,
      hasEmail: false,
      whatsappThreadChatId: null,
      hasFacebookId: false,
      hasInstagramId: false,
    };
  }

  const phone = firstPhoneFromRow(contact);
  const email = firstEmailFromRow(contact);

  return {
    name: contactThreadDisplayName(contact),
    hasPhone: Boolean(phone),
    hasEmail: Boolean(email),
    whatsappThreadChatId: guestPhoneToWhatsAppChatId(phone),
    hasFacebookId: hasMessagingPlatform(contact.contact_messaging_ids, "facebook"),
    hasInstagramId: hasMessagingPlatform(
      contact.contact_messaging_ids,
      "instagram",
    ),
  };
}

async function loadLinkedThreadSlice(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    pageLimit: number;
    before?: string | null;
  },
  mark: (
    source: string,
    ms: number,
    extra?: { fetched?: number; returned?: number; apiLimit?: number },
  ) => void,
): Promise<{
  messages: ContactMessageRow[];
  hasMore: boolean;
  oldestCursor: string | null;
  contact: ContactThreadContactMeta | null;
  error: string | null;
}> {
  const { restaurantId, contactId, pageLimit, before } = params;

  const tDb = performance.now();
  const dbPromise = fetchContactMessagesAdmin(admin, {
    restaurantId,
    threadKey: contactId,
    limit: pageLimit,
    before,
  }).then((dbResult) => {
    mark("db", Math.round(performance.now() - tDb), {
      fetched: dbResult.data.length,
      apiLimit: pageLimit,
      returned: dbResult.data.length,
    });
    return dbResult;
  });

  const tContact = performance.now();
  const contactPromise = loadContactRow(admin, restaurantId, contactId).then(
    (contact) => {
      mark("contact", Math.round(performance.now() - tContact));
      return contact;
    },
  );

  const [dbResult, contact] = await Promise.all([dbPromise, contactPromise]);

  if (dbResult.error) {
    return {
      messages: [],
      hasMore: false,
      oldestCursor: null,
      contact: null,
      error: dbResult.error.message,
    };
  }

  return {
    messages: dbResult.data,
    hasMore: dbResult.hasMore,
    oldestCursor:
      dbResult.data.length > 0 ? dbResult.data[0]!.created_at : null,
    contact: contactMetaFromRow(contact, "Kontakt"),
    error: null,
  };
}

async function loadConversationThreadSlice(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    threadKey: string;
    pageLimit: number;
    before?: string | null;
  },
  mark: (
    source: string,
    ms: number,
    extra?: { fetched?: number; returned?: number; apiLimit?: number },
  ) => void,
): Promise<{
  messages: ContactMessageRow[];
  hasMore: boolean;
  oldestCursor: string | null;
  error: string | null;
}> {
  const { restaurantId, threadKey, pageLimit, before } = params;
  const t0 = performance.now();
  const db = await fetchContactMessagesAdmin(admin, {
    restaurantId,
    threadKey,
    limit: pageLimit,
    before,
  });
  mark("db", Math.round(performance.now() - t0), {
    fetched: db.data.length,
    apiLimit: pageLimit,
    returned: db.data.length,
  });
  if (db.error) {
    return { messages: [], hasMore: false, oldestCursor: null, error: db.error.message };
  }
  return {
    messages: db.data,
    hasMore: db.hasMore,
    oldestCursor: db.data.length > 0 ? db.data[0]!.created_at : null,
    error: null,
  };
}

function contactMetaForThread(
  contactId: string,
  linkedMeta: ContactThreadContactMeta | null,
): ContactThreadContactMeta | null {
  if (linkedMeta) return linkedMeta;
  if (isWahaPseudoContactId(contactId)) {
    return {
      name: "WhatsApp",
      hasPhone: true,
      hasEmail: false,
      whatsappThreadChatId: wahaChatIdFromPseudoContactId(contactId),
      hasFacebookId: false,
      hasInstagramId: false,
    };
  }
  if (isEmailPseudoContactId(contactId)) {
    return {
      name: "E-Mail",
      hasPhone: false,
      hasEmail: true,
      whatsappThreadChatId: null,
      hasFacebookId: false,
      hasInstagramId: false,
    };
  }
  return null;
}

export async function fetchContactThreadPageServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    limit?: number;
    before?: string | null;
  },
): Promise<ContactThreadPageResult> {
  const pageLimit = params.limit ?? CONTACT_THREAD_PAGE_SIZE;
  const { restaurantId, contactId, before } = params;
  const { mark, finish } = createContactThreadTiming({
    contactId,
    pageLimit,
    before,
  });

  if (isLinkedContactId(contactId)) {
    const linked = await loadLinkedThreadSlice(
      admin,
      {
        restaurantId,
        contactId,
        pageLimit,
        before,
      },
      mark,
    );
    const timing = finish();
    logContactThreadTiming(timing);
    return {
      messages: linked.messages,
      hasMore: linked.hasMore,
      oldestCursor: linked.oldestCursor,
      contact: linked.contact,
      error: linked.error,
      timing,
    };
  }

  const slice = await loadConversationThreadSlice(
    admin,
    {
      restaurantId,
      threadKey: contactId,
      pageLimit,
      before,
    },
    mark,
  );

  const timing = finish();
  logContactThreadTiming(timing);

  return {
    messages: slice.messages,
    hasMore: slice.hasMore,
    oldestCursor: slice.oldestCursor,
    contact: contactMetaForThread(contactId, null),
    error: slice.error,
    timing,
  };
}
