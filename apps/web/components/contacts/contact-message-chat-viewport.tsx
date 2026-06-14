"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  ContactMessageBubbleList,
  type ContactMessageMetaReactionsConfig,
  type ContactMessageWahaReactionsConfig,
} from "@/components/contacts/contact-message-bubble-list";
import { ContactMessageChatSkeleton } from "@/components/contacts/contact-message-chat-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { cn } from "@/lib/utils";

const INITIAL_ANCHOR_MS = [0, 50, 150, 400, 800, 1200];

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
  metaReactions,
}: {
  messages: ContactMessageRow[];
  /** Wechsel der Konversation → wieder unten starten. */
  threadKey?: string;
  loading?: boolean;
  className?: string;
  listClassName?: string;
  onReservationOpen?: (reservationId: string) => void;
  wahaReactions?: ContactMessageWahaReactionsConfig;
  metaReactions?: ContactMessageMetaReactionsConfig;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const anchorInitialRef = useRef(false);
  const userReleasedScrollRef = useRef(false);

  const sorted = useMemo(
    () =>
      [...messages].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    [messages],
  );

  const tailId = sorted.length > 0 ? sorted[sorted.length - 1]?.id : null;
  const hasMessages = messages.length > 0;
  const showMessages = hasMessages || !loading;
  const showSkeleton = useDeferredSkeleton(loading && !hasMessages);

  const releaseAutoScroll = useCallback(() => {
    userReleasedScrollRef.current = true;
    stickToBottomRef.current = false;
    anchorInitialRef.current = false;
  }, []);

  const scrollToBottom = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollTop = vp.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 80;
    stickToBottomRef.current = atBottom;
    if (!atBottom) {
      releaseAutoScroll();
    }
  }, [releaseAutoScroll]);

  const runScrollToBottom = useCallback(() => {
    scrollToBottom();
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(() => scrollToBottom());
    });
  }, [scrollToBottom]);

  const prevLoadingRef = useRef(loading);

  const startBottomAnchor = useCallback(() => {
    userReleasedScrollRef.current = false;
    stickToBottomRef.current = true;
    anchorInitialRef.current = true;
    runScrollToBottom();

    const timers = INITIAL_ANCHOR_MS.map((ms) =>
      window.setTimeout(() => {
        if (anchorInitialRef.current && !userReleasedScrollRef.current) {
          runScrollToBottom();
        }
      }, ms),
    );

    const endAnchor = window.setTimeout(() => {
      anchorInitialRef.current = false;
    }, INITIAL_ANCHOR_MS[INITIAL_ANCHOR_MS.length - 1]! + 50);

    return () => {
      anchorInitialRef.current = false;
      for (const id of timers) window.clearTimeout(id);
      window.clearTimeout(endAnchor);
    };
  }, [runScrollToBottom]);

  useLayoutEffect(() => {
    if (!showMessages) return;
    return startBottomAnchor();
  }, [threadKey, showMessages, startBottomAnchor]);

  useLayoutEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;
    if (!showMessages || loading) return;
    if (!wasLoading || sorted.length === 0 || userReleasedScrollRef.current) {
      return;
    }
    return startBottomAnchor();
  }, [loading, showMessages, sorted.length, startBottomAnchor]);

  useLayoutEffect(() => {
    if (!showMessages || userReleasedScrollRef.current) return;
    if (!stickToBottomRef.current && !anchorInitialRef.current) return;
    runScrollToBottom();
  }, [sorted.length, tailId, runScrollToBottom, showMessages]);

  useLayoutEffect(() => {
    if (!showMessages) return;
    const content = contentRef.current;
    if (!content) return;

    const onLayout = () => {
      if (userReleasedScrollRef.current) return;
      if (stickToBottomRef.current || anchorInitialRef.current) {
        scrollToBottom();
      }
    };

    const ro = new ResizeObserver(onLayout);
    ro.observe(content);

    window.addEventListener("gwada:contact-chat-content-layout", onLayout);
    return () => {
      ro.disconnect();
      window.removeEventListener("gwada:contact-chat-content-layout", onLayout);
    };
  }, [scrollToBottom, threadKey, showMessages]);

  return (
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      onWheel={(e) => {
        if (e.deltaY < 0) releaseAutoScroll();
      }}
      onTouchMove={() => {
        const el = viewportRef.current;
        if (!el) return;
        const distanceFromBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom >= 80) releaseAutoScroll();
      }}
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain",
        className,
      )}
      aria-busy={loading || undefined}
    >
      {loading && !showSkeleton ? (
        <div className="min-h-[12rem]" aria-hidden />
      ) : null}
      {loading && showSkeleton ? (
        <div className="flex min-h-[12rem] flex-col justify-end">
          <ContactMessageChatSkeleton />
        </div>
      ) : null}
      {showMessages ? (
        <div
          ref={contentRef}
          className="flex min-h-full flex-col justify-end px-0"
        >
          <ContactMessageBubbleList
            messages={sorted}
            className={cn("py-1", listClassName)}
            onReservationOpen={onReservationOpen}
            wahaReactions={wahaReactions}
            metaReactions={metaReactions}
          />
        </div>
      ) : null}
    </div>
  );
}
