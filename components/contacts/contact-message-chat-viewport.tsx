"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  ContactMessageBubbleList,
  type ContactMessageWahaReactionsConfig,
} from "@/components/contacts/contact-message-bubble-list";
import { ContactMessageChatSkeleton } from "@/components/contacts/contact-message-chat-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { cn } from "@/lib/utils";

/**
 * Chat-Verlauf wie WhatsApp: chronologisch (älteste oben), beim Öffnen unten
 * bei der neuesten Nachricht; nach oben scrollen für ältere.
 */
export function ContactMessageChatViewport({
  messages,
  threadKey,
  loading = false,
  className,
  listClassName,
  onReservationOpen,
  wahaReactions,
}: {
  messages: ContactMessageRow[];
  /** Wechsel der Konversation → wieder unten starten. */
  threadKey?: string;
  loading?: boolean;
  className?: string;
  listClassName?: string;
  onReservationOpen?: (reservationId: string) => void;
  wahaReactions?: ContactMessageWahaReactionsConfig;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const sorted = useMemo(
    () =>
      [...messages].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    [messages],
  );

  const tailId = sorted.length > 0 ? sorted[sorted.length - 1]?.id : null;
  const showMessages = !loading;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    const vp = viewportRef.current;
    if (vp) {
      vp.scrollTop = vp.scrollHeight;
    }
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  }, []);

  const runScrollToBottom = useCallback(
    (behavior: ScrollBehavior = "instant") => {
      scrollToBottom(behavior);
      requestAnimationFrame(() => {
        scrollToBottom(behavior);
        requestAnimationFrame(() => scrollToBottom(behavior));
      });
    },
    [scrollToBottom],
  );

  useLayoutEffect(() => {
    if (!showMessages) return;
    stickToBottomRef.current = true;
    runScrollToBottom("instant");
  }, [threadKey, runScrollToBottom, showMessages]);

  useLayoutEffect(() => {
    if (!showMessages || !stickToBottomRef.current) return;
    runScrollToBottom("instant");
  }, [sorted.length, tailId, runScrollToBottom, showMessages]);

  useLayoutEffect(() => {
    if (!showMessages) return;
    const vp = viewportRef.current;
    if (!vp) return;

    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollToBottom("instant");
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, [scrollToBottom, threadKey, showMessages]);

  return (
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain",
        className,
      )}
      aria-busy={loading || undefined}
    >
      {loading && !showSkeleton ? (
        <div className="min-h-[12rem] flex-1" aria-hidden />
      ) : null}
      {loading && showSkeleton ? (
        <div className="flex min-h-min flex-1 flex-col justify-end">
          <ContactMessageChatSkeleton />
        </div>
      ) : null}
      {showMessages ? (
        <>
          <div className="flex min-h-min flex-1 flex-col justify-end">
            <ContactMessageBubbleList
              messages={sorted}
              className={cn("py-1", listClassName)}
              onReservationOpen={onReservationOpen}
              wahaReactions={wahaReactions}
            />
          </div>
          <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
        </>
      ) : null}
    </div>
  );
}
