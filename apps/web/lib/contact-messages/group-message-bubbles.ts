import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export type MessageBubbleGroup =
  | { kind: "single"; message: ContactMessageRow }
  | { kind: "batch"; messages: ContactMessageRow[] };

export function groupContactMessageBubbles(
  messages: ContactMessageRow[],
): MessageBubbleGroup[] {
  const byBatch = new Map<string, ContactMessageRow[]>();
  for (const m of messages) {
    const batchId = m.send_batch_id?.trim();
    if (!batchId) continue;
    const list = byBatch.get(batchId) ?? [];
    list.push(m);
    byBatch.set(batchId, list);
  }

  const emittedBatches = new Set<string>();
  const groups: MessageBubbleGroup[] = [];

  for (const m of messages) {
    const batchId = m.send_batch_id?.trim();
    if (batchId) {
      if (emittedBatches.has(batchId)) continue;
      emittedBatches.add(batchId);
      const batch = [...(byBatch.get(batchId) ?? [m])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      groups.push({ kind: "batch", messages: batch });
      continue;
    }
    groups.push({ kind: "single", message: m });
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
