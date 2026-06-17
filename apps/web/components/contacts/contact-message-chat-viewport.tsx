"use client";

import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ContactMessageBubbleList,
  type ContactMessageMetaReactionsConfig,
  type ContactMessageWahaReactionsConfig,
} from "@/components/contacts/contact-message-bubble-list";
import { ContactMessageChatSkeleton } from "@/components/contacts/contact-message-chat-skeleton";
import { Button } from "@/components/ui/button";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { cn } from "@/lib/utils";

const INITIAL_ANCHOR_MS = [0, 80, 300];

function messagesAlreadySorted(messages: ContactMessageRow[]): boolean {
  for (let i = 1; i < messages.length; i++) {
    if (messages[i - 1]!.created_at > messages[i]!.created_at) return false;
  }
  return true;
}

/**
 * Chat-Verlauf wie WhatsApp: chronologisch (älteste oben), beim Öffnen unten
 * bei der neuesten Nachricht; nach oben scrollen für ältere.
 */
export const ContactMessageChatViewport = memo(function ContactMessageChatViewport({
  messages,
  threadKey,
  loading = false,
  hasMoreOlder = false,
  loadingOlder = false,
  onLoadOlder,
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
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
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
  const pointerInViewportRef = useRef(false);
  const contentScrollHeightRef = useRef(0);
  const prevThreadKeyRef = useRef(threadKey);
  const sawLoadingForThreadRef = useRef(false);
  const [threadPending, setThreadPending] = useState(false);

  const sorted = useMemo(() => {
    if (messagesAlreadySorted(messages)) return messages;
    return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [messages]);

  const tailId = sorted.length > 0 ? sorted[sorted.length - 1]?.id : null;
  const hasMessages = messages.length > 0;
  const awaitingThread = loading || threadPending;
  const showEmpty = !awaitingThread && !hasMessages;
  const showDeferredSkeleton = useDeferredSkeleton(loading && !hasMessages);
  const showSkeleton = (loading && !hasMessages && showDeferredSkeleton) || (threadPending && !hasMessages);

  useLayoutEffect(() => {
    if (threadKey !== prevThreadKeyRef.current) {
      prevThreadKeyRef.current = threadKey;
      sawLoadingForThreadRef.current = false;
      contentScrollHeightRef.current = 0;
      setThreadPending(Boolean(threadKey));
    }
    if (loading) {
      sawLoadingForThreadRef.current = true;
    }
  }, [threadKey, loading]);

  useLayoutEffect(() => {
    if (hasMessages) {
      setThreadPending(false);
      return;
    }
    if (!loading && threadPending && sawLoadingForThreadRef.current) {
      setThreadPending(false);
    }
  }, [hasMessages, loading, threadPending]);

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
  const loadingOlderRef = useRef(loadingOlder);
  const scrollHeightBeforeOlderRef = useRef(0);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    if (loadingOlder && !loadingOlderRef.current) {
      scrollHeightBeforeOlderRef.current = vp.scrollHeight;
    }

    if (!loadingOlder && loadingOlderRef.current) {
      const delta = vp.scrollHeight - scrollHeightBeforeOlderRef.current;
      if (delta > 0) {
        vp.scrollTop += delta;
      }
    }

    loadingOlderRef.current = loadingOlder;
  }, [loadingOlder, sorted.length]);

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
    if (!hasMessages && loading) return;
    return startBottomAnchor();
  }, [threadKey, hasMessages, loading, startBottomAnchor]);

  useLayoutEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;
    if (loading || !hasMessages) return;
    if (!wasLoading || userReleasedScrollRef.current) {
      return;
    }
    return startBottomAnchor();
  }, [loading, hasMessages, startBottomAnchor]);

  useLayoutEffect(() => {
    if (!hasMessages || userReleasedScrollRef.current) return;
    if (!stickToBottomRef.current && !anchorInitialRef.current) return;
    runScrollToBottom();
  }, [sorted.length, tailId, runScrollToBottom, hasMessages]);

  useLayoutEffect(() => {
    if (!hasMessages) return;
    const content = contentRef.current;
    if (!content) return;

    let layoutRaf = 0;

    const onLayout = () => {
      if (layoutRaf) return;
      layoutRaf = requestAnimationFrame(() => {
        layoutRaf = 0;
        if (userReleasedScrollRef.current) return;
        if (pointerInViewportRef.current && !anchorInitialRef.current) return;

        const vp = viewportRef.current;
        if (!vp) return;
        const nextHeight = vp.scrollHeight;
        const prevHeight = contentScrollHeightRef.current;
        contentScrollHeightRef.current = nextHeight;

        if (!anchorInitialRef.current && nextHeight <= prevHeight) return;

        if (stickToBottomRef.current || anchorInitialRef.current) {
          scrollToBottom();
        }
      });
    };

    const ro = new ResizeObserver(onLayout);
    ro.observe(content);

    window.addEventListener("gwada:contact-chat-content-layout", onLayout);
    return () => {
      if (layoutRaf) cancelAnimationFrame(layoutRaf);
      ro.disconnect();
      window.removeEventListener("gwada:contact-chat-content-layout", onLayout);
    };
  }, [scrollToBottom, threadKey, hasMessages]);

  return (
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      onMouseEnter={() => {
        pointerInViewportRef.current = true;
      }}
      onMouseLeave={() => {
        pointerInViewportRef.current = false;
      }}
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
      aria-busy={awaitingThread || undefined}
    >
      {awaitingThread && !showSkeleton ? (
        <div className="min-h-[12rem]" aria-hidden />
      ) : null}
      {showSkeleton ? (
        <div className="flex min-h-[12rem] flex-col justify-end">
          <ContactMessageChatSkeleton />
        </div>
      ) : null}
      {showEmpty ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Noch keine Nachrichten in diesem Verlauf.
        </p>
      ) : null}
      {hasMessages ? (
        <div
          ref={contentRef}
          className="flex min-h-full flex-col justify-end px-0"
        >
          {hasMoreOlder && onLoadOlder ? (
            <div className="flex justify-center py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={loadingOlder}
                onClick={onLoadOlder}
              >
                {loadingOlder
                  ? "Ältere Nachrichten werden geladen …"
                  : "Ältere Nachrichten anzeigen"}
              </Button>
            </div>
          ) : null}
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
});
