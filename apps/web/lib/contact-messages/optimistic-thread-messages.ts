import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import {
  bodiesIndicateSameWhatsappSend,
  dedupeWhatsappOutboundThreadRows,
  isWhatsappSyncAnchorRow,
} from "@/lib/contact-messages/whatsapp-mirror-preview";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export const OPTIMISTIC_MESSAGE_ID_PREFIX = "optimistic:";

const OPTIMISTIC_SUPERSEDE_MS = 3 * 60 * 1000;

export function isOptimisticContactMessage(m: ContactMessageRow): boolean {
  return (
    m.id.startsWith(OPTIMISTIC_MESSAGE_ID_PREFIX) ||
    (m.external_source_id?.startsWith(OPTIMISTIC_MESSAGE_ID_PREFIX) ?? false)
  );
}

function sortByCreatedAt(messages: ContactMessageRow[]): ContactMessageRow[] {
  return [...messages].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

function attachmentKindFromFile(file: File): ContactMessageAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "voice";
  return "file";
}

function optimisticAttachmentsFromSend(params: {
  files?: File[];
  voiceNote?: File;
  voicePreviewUrl?: string;
}): ContactMessageAttachment[] | undefined {
  if (params.voiceNote) {
    return [
      {
        id: "0",
        kind: "voice",
        fileName: params.voiceNote.name || "Sprachnachricht",
        mimeType: params.voiceNote.type || "audio/ogg",
        url: params.voicePreviewUrl ?? "",
      },
    ];
  }
  if (!params.files?.length) return undefined;
  return params.files.map((file, index) => ({
    id: String(index),
    kind: attachmentKindFromFile(file),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    url: "",
  }));
}

export function createOptimisticOutboundWhatsappMessage(params: {
  restaurantId: string;
  contactId: string;
  body: string;
  files?: File[];
  voiceNote?: File;
  voicePreviewUrl?: string;
  clientId?: string;
}): ContactMessageRow {
  const clientId = params.clientId ?? crypto.randomUUID();
  const attachments = optimisticAttachmentsFromSend(params);
  const text = params.body.trim();

  return {
    id: `${OPTIMISTIC_MESSAGE_ID_PREFIX}${clientId}`,
    restaurant_id: params.restaurantId,
    contact_id: params.contactId,
    platform: "whatsapp",
    direction: "outbound",
    body: text || (attachments?.length ? "" : " "),
    reservation_id: null,
    sent_by: null,
    delivery_status: "pending",
    created_at: new Date().toISOString(),
    external_source_id: `${OPTIMISTIC_MESSAGE_ID_PREFIX}${clientId}`,
    waha_ack: null,
    attachments,
  };
}

export function appendOptimisticMessage(
  messages: ContactMessageRow[],
  message: ContactMessageRow,
): ContactMessageRow[] {
  return sortByCreatedAt([...messages, message]);
}

export function removeOptimisticMessage(
  messages: ContactMessageRow[],
  optimisticId: string,
): ContactMessageRow[] {
  return messages.filter((m) => m.id !== optimisticId);
}

export function patchWhatsappMessageByWahaId(
  messages: ContactMessageRow[],
  wahaMessageId: string,
  body: string,
): ContactMessageRow[] {
  const externalSourceId = `waha:${wahaMessageId}`;
  return messages.map((m) => {
    if (
      m.waha_message_id === wahaMessageId ||
      m.external_source_id === externalSourceId
    ) {
      return { ...m, body };
    }
    return m;
  });
}

export function removeWhatsappMessageByWahaId(
  messages: ContactMessageRow[],
  wahaMessageId: string,
): ContactMessageRow[] {
  const externalSourceId = `waha:${wahaMessageId}`;
  return messages.filter(
    (m) =>
      m.waha_message_id !== wahaMessageId &&
      m.external_source_id !== externalSourceId,
  );
}

function messagesMatchForOptimisticReplace(
  optimistic: ContactMessageRow,
  loaded: ContactMessageRow,
): boolean {
  if (loaded.direction !== "outbound") return false;
  if (messageDisplayPlatform(loaded) !== "whatsapp") return false;

  const optAttachments = optimistic.attachments ?? [];
  const loadedAttachments = loaded.attachments ?? [];

  if (optAttachments.length > 0 || loadedAttachments.length > 0) {
    if (optAttachments.length !== loadedAttachments.length) return false;
    if (optAttachments.length === 0) return false;
    return optAttachments[0]?.kind === loadedAttachments[0]?.kind;
  }

  const optBody = optimistic.body.trim();
  const loadedBody = loaded.body.trim();
  if (!optBody && !loadedBody) return false;
  return bodiesIndicateSameWhatsappSend(optBody, loadedBody);
}

function findBestLoadedMatchForOptimistic(
  optimistic: ContactMessageRow,
  loaded: ContactMessageRow[],
  usedLoadedIds: Set<string>,
): ContactMessageRow | null {
  const optimisticTime = Date.parse(optimistic.created_at);
  if (!Number.isFinite(optimisticTime)) return null;

  let best: ContactMessageRow | null = null;
  let bestDelta = Infinity;

  for (const message of loaded) {
    if (usedLoadedIds.has(message.id)) continue;
    if (!messagesMatchForOptimisticReplace(optimistic, message)) continue;

    const loadedTime = Date.parse(message.created_at);
    if (!Number.isFinite(loadedTime)) continue;

    const delta = Math.abs(loadedTime - optimisticTime);
    if (delta > OPTIMISTIC_SUPERSEDE_MS) continue;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = message;
    }
  }

  return best;
}

/** Server-Thread mit noch nicht bestätigten Optimistic-Zeilen zusammenführen. */
export function mergeLoadedThreadWithOptimistic(
  loaded: ContactMessageRow[],
  previous: ContactMessageRow[],
): ContactMessageRow[] {
  const dedupedLoaded = dedupeWhatsappOutboundThreadRows(loaded);
  const optimistic = previous
    .filter(isOptimisticContactMessage)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (optimistic.length === 0) return dedupedLoaded;

  const usedLoadedIds = new Set<string>();
  const pendingOptimistic: ContactMessageRow[] = [];

  for (const message of optimistic) {
    const match = findBestLoadedMatchForOptimistic(
      message,
      dedupedLoaded,
      usedLoadedIds,
    );
    if (match) {
      usedLoadedIds.add(match.id);
    } else {
      const hasAnchorDuplicate = dedupedLoaded.some(
        (loadedMessage) =>
          isWhatsappSyncAnchorRow(loadedMessage) &&
          loadedMessage.direction === message.direction &&
          messagesMatchForOptimisticReplace(message, loadedMessage),
      );
      if (!hasAnchorDuplicate) {
        pendingOptimistic.push(message);
      }
    }
  }

  if (pendingOptimistic.length === 0) return dedupedLoaded;
  return sortByCreatedAt([...dedupedLoaded, ...pendingOptimistic]);
}

/** Optimistic-Zeilen entfernen, die bereits als WAHA-Anker im Thread stehen. */
export function dropOptimisticMatchingAnchors(
  messages: ContactMessageRow[],
): ContactMessageRow[] {
  const anchors = messages.filter(isWhatsappSyncAnchorRow);
  if (!anchors.length) return messages;

  return messages.filter((message) => {
    if (!isOptimisticContactMessage(message)) return true;
    return !anchors.some(
      (anchor) =>
        anchor.direction === message.direction &&
        messagesMatchForOptimisticReplace(message, anchor),
    );
  });
}
