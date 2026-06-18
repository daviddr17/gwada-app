"use client";

import { useEffect, useRef } from "react";
import { resolveConversationThreadRef } from "@/lib/contact-messages/conversation-thread-key";
import { isPublicSupabaseProxyEnabled } from "@/lib/public-env";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  mapContactMessageRowFromRecord,
  type ContactMessageRow,
} from "@/lib/supabase/contact-messages-db";
import { subscribeRestaurantTableChanges } from "@/lib/supabase/restaurant-table-realtime";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

type ContactThreadRealtimeHandlers = {
  onInsert: (row: ContactMessageRow) => void;
  onUpdate: (row: ContactMessageRow) => void;
};

/**
 * Thread-Live: INSERT/UPDATE auf `contact_messages` für verknüpfte und Pseudo-Threads.
 */
export function useContactThreadRealtime(
  threadKey: string | null | undefined,
  handlers: ContactThreadRealtimeHandlers,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const sbRef = useRef(createSupabaseBrowserClient());
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const threadRef = useRef(resolveConversationThreadRef(threadKey ?? ""));

  useEffect(() => {
    threadRef.current = resolveConversationThreadRef(threadKey ?? "");
  }, [threadKey]);

  useEffect(() => {
    if (!enabled) return;
    if (!ready || !restaurantId || !isUuidRestaurantId(restaurantId)) return;
    if (!threadKey) return;

    const thread = resolveConversationThreadRef(threadKey);
    if (!thread.contactId && !thread.conversationKey) return;
    if (isPublicSupabaseProxyEnabled()) return;

    const matchesThread = (row: Record<string, unknown>) => {
      if (thread.contactId) {
        return row.contact_id === thread.contactId;
      }
      return row.conversation_key === thread.conversationKey;
    };

    const teardown = subscribeRestaurantTableChanges(sbRef.current, {
      channelName: `contact-thread-live:${restaurantId}:${threadKey}`,
      table: "contact_messages",
      restaurantId,
      events: ["INSERT", "UPDATE"],
      onChange: (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (!matchesThread(row)) return;

        const mapped = mapContactMessageRowFromRecord(row);
        if (payload.eventType === "INSERT") {
          handlersRef.current.onInsert(mapped);
        } else {
          handlersRef.current.onUpdate(mapped);
        }
      },
    });

    return teardown;
  }, [enabled, ready, restaurantId, threadKey]);
}
