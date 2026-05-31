import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export type MessageBubbleGroup =
  | { kind: "single"; message: ContactMessageRow }
  | { kind: "batch"; messages: ContactMessageRow[] };

export function groupContactMessageBubbles(
  messages: ContactMessageRow[],
): MessageBubbleGroup[] {
  const groups: MessageBubbleGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const current = messages[i];
    const batchId = current.send_batch_id;

    if (batchId) {
      const batch: ContactMessageRow[] = [current];
      let j = i + 1;
      while (
        j < messages.length &&
        messages[j].send_batch_id === batchId
      ) {
        batch.push(messages[j]);
        j++;
      }
      groups.push({ kind: "batch", messages: batch });
      i = j;
      continue;
    }

    groups.push({ kind: "single", message: current });
    i++;
  }

  return groups;
}

export function platformsForBubbleGroup(
  group: MessageBubbleGroup,
): ContactMessagePlatform[] {
  const list =
    group.kind === "single"
      ? [group.message.platform]
      : group.messages.map((m) => m.platform);
  return [...new Set(list)];
}

export function primaryMessageForGroup(
  group: MessageBubbleGroup,
): ContactMessageRow {
  if (group.kind === "single") return group.message;
  const gwada = group.messages.find((m) => m.platform === "gwada");
  return gwada ?? group.messages[0];
}
