import "server-only";

import { ingestInboundContactMessage } from "@/lib/contacts/ingest-inbound-contact-message";
import {
  attachmentKindFromImapMeta,
  EMAIL_IMAP_EXTERNAL_PREFIX,
  persistEmailImapMessageAttachments,
} from "@/lib/contacts/persist-email-imap-message-attachments";
import { assignConversationThreadToContact } from "@/lib/contact-messages/assign-conversation-thread-to-contact";
import {
  emailAddressFromPseudoContactId,
  isEmailPseudoContactId,
} from "@/lib/contact-messages/email-pseudo-contact";
import { fetchEmailInboxThread } from "@/lib/contact-messages/email-inbox-service";
import type { SupabaseClient } from "@supabase/supabase-js";

const EXTERNAL_PREFIX = EMAIL_IMAP_EXTERNAL_PREFIX;

function externalIdForImapRow(messageId: string): string | null {
  if (!messageId.startsWith("imap:")) return null;
  return `${EXTERNAL_PREFIX}${messageId.slice(5)}`;
}

function uidFromImapRowId(messageId: string): number | null {
  if (!messageId.startsWith("imap:")) return null;
  const n = Number.parseInt(messageId.slice(5), 10);
  return Number.isFinite(n) ? n : null;
}

async function ensureEmailOnContact(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    emailNormalized: string;
  },
): Promise<{ ok: boolean; error: string | null }> {
  const { data: existing } = await admin
    .from("contact_emails")
    .select("contact_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("email_normalized", params.emailNormalized)
    .maybeSingle();

  if (existing?.contact_id) {
    if (existing.contact_id === params.contactId) {
      return { ok: true, error: null };
    }
    return { ok: false, error: "email_on_other_contact" };
  }

  const { error } = await admin.from("contact_emails").insert({
    contact_id: params.contactId,
    restaurant_id: params.restaurantId,
    email: params.emailNormalized,
    email_normalized: params.emailNormalized,
    is_primary: false,
    sort_order: 0,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function linkEmailThreadToContact(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    emailPseudoContactId: string;
  },
): Promise<{ ok: boolean; imported: number; error: string | null }> {
  if (!isEmailPseudoContactId(params.emailPseudoContactId)) {
    return { ok: false, imported: 0, error: "invalid_email_contact" };
  }

  const emailNorm = emailAddressFromPseudoContactId(params.emailPseudoContactId);
  if (!emailNorm) {
    return { ok: false, imported: 0, error: "invalid_email_contact" };
  }

  const { data: contact } = await admin
    .from("contacts")
    .select("id")
    .eq("id", params.contactId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (!contact) {
    return { ok: false, imported: 0, error: "contact_not_found" };
  }

  const ensured = await ensureEmailOnContact(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    emailNormalized: emailNorm,
  });
  if (!ensured.ok) {
    return { ok: false, imported: 0, error: ensured.error };
  }

  await assignConversationThreadToContact(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    conversationKey: params.emailPseudoContactId,
  });

  const { data: messages, error: fetchErr } = await fetchEmailInboxThread(
    admin,
    {
      restaurantId: params.restaurantId,
      contactId: params.emailPseudoContactId,
    },
  );

  if (fetchErr) {
    return { ok: false, imported: 0, error: fetchErr };
  }

  let imported = 0;
  for (const m of messages) {
    const ext = externalIdForImapRow(m.id);
    const uid = uidFromImapRowId(m.id);
    const meta = (m.attachments ?? []).map((a, index) => ({
      index: Number.parseInt(a.id, 10) || index,
      fileName: a.fileName,
      mimeType: a.mimeType,
      byteSize: a.byteSize ?? null,
    }));
    const body = m.body?.trim() ?? "";
    if (!ext || uid == null) continue;
    if (!body && meta.length === 0) continue;

    const result = await ingestInboundContactMessage(admin, {
      restaurantId: params.restaurantId,
      contactId: params.contactId,
      platform: "email",
      direction: m.direction,
      body: body || " ",
      externalSourceId: ext,
      createdAt: m.created_at,
      attachmentKind: attachmentKindFromImapMeta(meta),
    });
    if (result.messageId) {
      await persistEmailImapMessageAttachments(admin, {
        restaurantId: params.restaurantId,
        messageId: result.messageId,
        uid,
        attachments: meta,
      });
    }
    if (result.imported) imported += 1;
  }

  return { ok: true, imported, error: null };
}
