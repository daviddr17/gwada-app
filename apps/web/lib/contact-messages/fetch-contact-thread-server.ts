import "server-only";

import { fetchContactMessagesAdmin } from "@/lib/contact-messages/contact-messages-admin";
import {
  CONTACT_THREAD_PAGE_SIZE,
} from "@/lib/contact-messages/contact-thread-pagination";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { isMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import {
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { contactThreadDisplayName } from "@/lib/supabase/contacts-db";
import { pickContactThreadTitle } from "@/lib/contacts/contact-thread-title";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import {
  createContactThreadTiming,
  logContactThreadTiming,
  type ContactThreadTiming,
} from "@/lib/contact-messages/contact-thread-timing";
import { resolveContactThreadAvatarPresentation } from "@/lib/contacts/contact-thread-avatar-server";
import { contactThreadAvatarInitials } from "@/lib/contacts/contact-thread-avatar-initials";
import {
  backfillEmailImapAttachmentMeta,
  syncContactEmailInbox,
} from "@/lib/contacts/sync-restaurant-email-inbox";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Beim ersten Thread-Load: Anhang-Metadaten (lazy IMAP) nachziehen. */
async function ensureEmailAttachmentMetaForThreadOpen(
  admin: SupabaseClient,
  params: { restaurantId: string; contactId: string },
): Promise<void> {
  try {
    if (isLinkedContactId(params.contactId)) {
      await syncContactEmailInbox(admin, params);
      return;
    }
    if (!isEmailPseudoContactId(params.contactId)) return;
    const creds = await resolveRestaurantImapCredentials(
      admin,
      params.restaurantId,
    );
    if (!creds) return;
    await backfillEmailImapAttachmentMeta(admin, creds, {
      restaurantId: params.restaurantId,
      conversationKey: params.contactId,
    });
  } catch {
    /* Thread-Load nicht blockieren bei IMAP-Fehlern */
  }
}

export type ContactThreadContactMeta = {
  name: string;
  hasPhone: boolean;
  hasEmail: boolean;
  whatsappThreadChatId: string | null;
  hasFacebookId: boolean;
  hasInstagramId: boolean;
  avatarUrl: string | null;
  avatarInitials: string;
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
  company?: string | null;
  contact_phones?:
    | { phone_display: string; is_primary?: boolean; sort_order?: number }[]
    | { phone_display: string; is_primary?: boolean; sort_order?: number }
    | null;
  contact_emails?: { email: string }[] | { email: string } | null;
  contact_messaging_ids?: { platform: string; external_sender_id: string }[] | null;
};

function hasMessagingPlatform(
  rows: ContactRow["contact_messaging_ids"],
  platform: "facebook" | "instagram" | "whatsapp",
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
      company,
      contact_phones ( phone_display, is_primary, sort_order ),
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
  const sorted = [...rows].sort(
    (a, b) =>
      Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  for (const row of sorted) {
    const phone = row.phone_display?.trim();
    if (phone) return phone;
  }
  return null;
}

function whatsappChatIdFromContactRow(contact: ContactRow): string | null {
  const fromPhone = guestPhoneToWhatsAppChatId(firstPhoneFromRow(contact));
  if (fromPhone) return fromPhone;
  const list = Array.isArray(contact.contact_messaging_ids)
    ? contact.contact_messaging_ids
    : [];
  const wa = list.find(
    (r) => r.platform === "whatsapp" && r.external_sender_id?.trim(),
  );
  return wa?.external_sender_id.trim() ?? null;
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
      avatarUrl: null,
      avatarInitials: contactThreadAvatarInitials({ displayName: fallbackName }),
    };
  }

  const phone = firstPhoneFromRow(contact);
  const email = firstEmailFromRow(contact);
  // Nie leeren Titel → UI-Fallback „Kontakt“; E-Mail/Telefon sind besser lesbar.
  const name = pickContactThreadTitle(
    contactThreadDisplayName(contact),
    email,
    phone,
    fallbackName,
  );

  return {
    name,
    hasPhone: Boolean(phone),
    hasEmail: Boolean(email),
    whatsappThreadChatId: whatsappChatIdFromContactRow(contact),
    hasFacebookId: hasMessagingPlatform(contact.contact_messaging_ids, "facebook"),
    hasInstagramId: hasMessagingPlatform(
      contact.contact_messaging_ids,
      "instagram",
    ),
    avatarUrl: null,
    avatarInitials: contactThreadAvatarInitials({
      displayName: name,
      firstName: contact.first_name,
      lastName: contact.last_name,
    }),
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
    contact: await enrichContactThreadMetaWithAvatar(admin, {
      restaurantId,
      meta: contactMetaFromRow(contact, "Kontakt"),
      linkedContactId: contactId,
      firstName: contact?.first_name,
      lastName: contact?.last_name,
      includeAvatar: !before,
    }),
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

async function enrichContactThreadMetaWithAvatar(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    meta: ContactThreadContactMeta;
    linkedContactId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    includeAvatar: boolean;
  },
): Promise<ContactThreadContactMeta> {
  if (!params.includeAvatar) return params.meta;

  const avatar = await resolveContactThreadAvatarPresentation(admin, {
    restaurantId: params.restaurantId,
    displayName: params.meta.name,
    firstName: params.firstName,
    lastName: params.lastName,
    linkedContactId: params.linkedContactId,
    whatsappChatId: params.meta.whatsappThreadChatId,
  });

  return {
    ...params.meta,
    avatarUrl: avatar.avatarUrl,
    avatarInitials: avatar.avatarInitials,
  };
}

async function contactMetaForThread(
  admin: SupabaseClient,
  restaurantId: string,
  contactId: string,
  linkedMeta: ContactThreadContactMeta | null,
  options?: { includeAvatar?: boolean },
): Promise<ContactThreadContactMeta | null> {
  if (linkedMeta) return linkedMeta;
  if (isWahaPseudoContactId(contactId)) {
    const chatId = wahaChatIdFromPseudoContactId(contactId);
    const base: ContactThreadContactMeta = {
      name: "WhatsApp",
      hasPhone: true,
      hasEmail: false,
      whatsappThreadChatId: chatId,
      hasFacebookId: false,
      hasInstagramId: false,
      avatarUrl: null,
      avatarInitials: contactThreadAvatarInitials({ displayName: "WhatsApp" }),
    };
    if (!options?.includeAvatar || !chatId) return base;
    const avatar = await resolveContactThreadAvatarPresentation(admin, {
      restaurantId,
      displayName: base.name,
      whatsappChatId: chatId,
    });
    return { ...base, ...avatar };
  }
  if (isEmailPseudoContactId(contactId)) {
    return {
      name: "E-Mail",
      hasPhone: false,
      hasEmail: true,
      whatsappThreadChatId: null,
      hasFacebookId: false,
      hasInstagramId: false,
      avatarUrl: null,
      avatarInitials: contactThreadAvatarInitials({ displayName: "E-Mail" }),
    };
  }
  if (isMetaPseudoContactId(contactId)) {
    return {
      name: "Messenger",
      hasPhone: false,
      hasEmail: false,
      whatsappThreadChatId: null,
      hasFacebookId: true,
      hasInstagramId: false,
      avatarUrl: null,
      avatarInitials: contactThreadAvatarInitials({ displayName: "Messenger" }),
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

  if (!before) {
    // Nicht blockieren: IMAP-Meta nachziehen im Hintergrund — Thread kommt sofort aus DB.
    void ensureEmailAttachmentMetaForThreadOpen(admin, {
      restaurantId,
      contactId,
    }).catch(() => {
      /* best-effort */
    });
  }

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
    contact: await contactMetaForThread(
      admin,
      restaurantId,
      contactId,
      null,
      { includeAvatar: !before },
    ),
    error: slice.error,
    timing,
  };
}
