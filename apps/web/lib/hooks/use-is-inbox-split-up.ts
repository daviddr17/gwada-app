"use client";

import { useSyncExternalStore } from "react";
import { APP_INBOX_SPLIT_MQ } from "@/lib/ui/app-chrome-breakpoints";

function subscribeInboxSplit(onChange: () => void): () => void {
  const mq = window.matchMedia(APP_INBOX_SPLIT_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getInboxSplitSnapshot(): boolean {
  return window.matchMedia(APP_INBOX_SPLIT_MQ).matches;
}

function getInboxSplitServerSnapshot(): boolean {
  return false;
}

/**
 * Nachrichten Master-Detail (Liste | Chat) — ab Tailwind `md` (768px),
 * damit iPhone Pro Max Landscape den Split bekommt, ohne Desktop-Sidebar.
 */
export function useIsInboxSplitUp(): boolean {
  return useSyncExternalStore(
    subscribeInboxSplit,
    getInboxSplitSnapshot,
    getInboxSplitServerSnapshot,
  );
}
