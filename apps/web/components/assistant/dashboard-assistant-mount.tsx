"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantPendingAction } from "@/lib/assistant/assistant-actions";
import { consumeAssistantChatStream } from "@/lib/assistant/assistant-chat-stream-client";
import type { AssistantSsePhase } from "@/lib/assistant/assistant-chat-sse";
import {
  AssistantChatHeaderActions,
  AssistantChatPanel,
  type AssistantChatMessage,
  type AssistantChatThread,
} from "@/components/assistant/assistant-chat-panel";
import { AppMobileChromeScreen } from "@/components/layout/app-mobile-chrome-screen";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isSuperadminAppPath } from "@/lib/superadmin/superadmin-session";
import { createPortal } from "react-dom";
import {
  getLocalAssistantThread,
  mergeAssistantThreadLists,
  readLocalAssistantThreads,
  titleFromAssistantMessage,
  upsertLocalAssistantThread,
} from "@/lib/assistant/assistant-chat-local";
import { useAssistantMobileKeyboardInset } from "@/lib/hooks/use-assistant-mobile-keyboard-inset";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useIsMobile } from "@/hooks/use-mobile";
import { APP_LOCALE_TO_PROFILE, normalizeAppLocale } from "@/i18n/config";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import {
  appMobileAssistantFabEndClassName,
  appMobileFabBottomClassName,
  appMobileFabButtonClassName,
  appMobileFabIconClassName,
} from "@/lib/ui/app-mobile-bottom-nav";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { cn } from "@/lib/utils";

type ChatMessage = AssistantChatMessage;
type Thread = AssistantChatThread;

function newLocalId(prefix = "local") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speakReply(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  window.speechSynthesis.speak(utter);
}

/** Sheet-Open-Kurve in AppMobileChromeScreen (~520 ms) — Fokus danach. */
const MOBILE_FOCUS_DELAY_MS = 560;
const DESKTOP_FOCUS_DELAY_MS = 220;

export function DashboardAssistantMount() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const pathname = usePathname();
  const zone = isSuperadminAppPath(pathname) ? "superadmin" : "restaurant";
  const locale = normalizeAppLocale(useLocale());
  const dateLocale = APP_LOCALE_TO_PROFILE[locale];
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamPhase, setStreamPhase] = useState<AssistantSsePhase | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AssistantPendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [listening, setListening] = useState(false);
  const canSpeakInput = speechRecognitionCtor() != null;
  const voiceTurnRef = useRef(false);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const confirmedRef = useRef(false);
  const suppressCancelRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const streamMsgIdRef = useRef<string | null>(null);
  const sendGenerationRef = useRef(0);
  const keyboardInset = useAssistantMobileKeyboardInset(open && isMobile);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const delay = isMobile ? MOBILE_FOCUS_DELAY_MS : DESKTOP_FOCUS_DELAY_MS;
    const t = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, delay);
    return () => window.clearTimeout(t);
  }, [open, threadId, isMobile]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, sending, streamPhase]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const mirrorThreadLocal = useCallback(
    (id: string, nextMessages: ChatMessage[], titleHint?: string) => {
      if (!restaurantId || !id) return;
      const existing = getLocalAssistantThread(restaurantId, id);
      const firstUser = nextMessages.find((m) => m.role === "user");
      upsertLocalAssistantThread(restaurantId, {
        id,
        title:
          titleHint?.trim() ||
          existing?.title ||
          titleFromAssistantMessage(firstUser?.content ?? "") ||
          "Chat",
        updated_at: new Date().toISOString(),
        messages: nextMessages,
      });
    },
    [restaurantId],
  );

  const loadThreads = useCallback(async () => {
    if (!restaurantId) return;
    const local = readLocalAssistantThreads(restaurantId);
    try {
      const res = await fetch(
        `/api/assistant/threads?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      const json = (await res.json().catch(() => ({}))) as {
        threads?: Thread[];
        error?: string;
      };
      const server = res.ok ? (json.threads ?? []) : [];
      if (!res.ok) {
        console.warn("[assistant] threads", json.error ?? res.status);
      }
      setBootError(null);
      setThreads(mergeAssistantThreadLists(server, local));
    } catch (e) {
      console.warn("[assistant] threads", e);
      setThreads(
        mergeAssistantThreadLists(
          [],
          local,
        ),
      );
    }
  }, [restaurantId]);

  const loadThread = useCallback(
    async (id: string) => {
      if (!restaurantId) return;
      setLoadingThread(true);
      try {
        const local = getLocalAssistantThread(restaurantId, id);
        const res = await fetch(
          `/api/assistant/threads/${encodeURIComponent(id)}?restaurantId=${encodeURIComponent(restaurantId)}`,
        );
        const json = (await res.json().catch(() => ({}))) as {
          messages?: Array<{ id: string; role: string; content: string }>;
          error?: string;
        };

        if (res.ok) {
          const next = (json.messages ?? [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            }));
          // Prefer server when it has messages; otherwise keep local mirror.
          const useMessages =
            next.length > 0 ? next : (local?.messages ?? []);
          setThreadId(id);
          setMessages(useMessages);
          if (useMessages.length > 0) {
            mirrorThreadLocal(id, useMessages, local?.title);
          }
          setShowHistory(false);
          setBootError(null);
          return;
        }

        if (local && local.messages.length > 0) {
          setThreadId(id);
          setMessages(local.messages);
          setShowHistory(false);
          setBootError(null);
          return;
        }

        setBootError(json.error ?? "Chat konnte nicht geladen werden.");
      } finally {
        setLoadingThread(false);
      }
    },
    [restaurantId, mirrorThreadLocal],
  );

  useEffect(() => {
    if (!open || !restaurantId) return;
    setBootError(null);
    void loadThreads();
  }, [open, restaurantId, loadThreads]);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendGenerationRef.current += 1;
    streamMsgIdRef.current = null;
    setSending(false);
    setStreamPhase(null);
    setThreadId(null);
    setMessages([]);
    setShowHistory(false);
    setBootError(null);
    setPendingAction(null);
  }, []);

  const send = useCallback(async (spoken?: string) => {
    if (!restaurantId) return;
    const text = (spoken ?? input).trim();
    if (!text) return;
    const fromVoice = typeof spoken === "string";
    voiceTurnRef.current = fromVoice;

    // New send aborts any in-flight stream (no double replies).
    abortRef.current?.abort();
    const generation = ++sendGenerationRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    // Drop unfinished streaming bubble from a previous turn.
    const baseMessages = messagesRef.current.filter((m) => !m.streaming);
    streamMsgIdRef.current = null;

    setInput("");
    setSending(true);
    setStreamPhase("thinking");
    setBootError(null);
    if (pendingAction) suppressCancelRef.current = true;
    setPendingAction(null);

    const userLocal: ChatMessage = {
      id: newLocalId("msg"),
      role: "user",
      content: text,
    };
    const assistantId = newLocalId("msg");
    streamMsgIdRef.current = assistantId;
    const withUser = [...baseMessages, userLocal];
    setMessages(withUser);

    let activeThreadId = threadId ?? newLocalId("thread");
    if (!threadId) {
      setThreadId(activeThreadId);
      mirrorThreadLocal(activeThreadId, withUser, titleFromAssistantMessage(text));
    }

    const patchAssistant = (content: string, streaming: boolean) => {
      if (sendGenerationRef.current !== generation) return;
      setMessages((prev) => {
        const withoutStream = prev.filter((m) => m.id !== assistantId && !m.streaming);
        if (!content && streaming) {
          // Keep empty streaming bubble out of the list — typing row shows instead.
          messagesRef.current = withoutStream;
          return withoutStream;
        }
        const next = [
          ...withoutStream,
          { id: assistantId, role: "assistant" as const, content, streaming },
        ];
        messagesRef.current = next;
        return next;
      });
    };

    let streamed = "";
    let pendingFromStream: AssistantPendingAction | null = null;

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
        body: JSON.stringify({
          restaurantId,
          threadId: threadId && !threadId.startsWith("thread-") ? threadId : null,
          message: text,
          zone,
        }),
      });

      const result = await consumeAssistantChatStream(res, {
        onMeta: (meta) => {
          if (sendGenerationRef.current !== generation) return;
          if (meta.threadId) {
            if (
              activeThreadId !== meta.threadId &&
              activeThreadId.startsWith("thread-")
            ) {
              const placeholder = getLocalAssistantThread(
                restaurantId,
                activeThreadId,
              );
              if (placeholder) {
                upsertLocalAssistantThread(restaurantId, {
                  ...placeholder,
                  id: meta.threadId,
                });
              }
            }
            activeThreadId = meta.threadId;
            setThreadId(meta.threadId);
          }
        },
        onStatus: (phase) => {
          if (sendGenerationRef.current !== generation) return;
          setStreamPhase(phase);
        },
        onDelta: (piece) => {
          if (sendGenerationRef.current !== generation) return;
          streamed += piece;
          patchAssistant(streamed, true);
        },
        onReset: () => {
          if (sendGenerationRef.current !== generation) return;
          streamed = "";
          patchAssistant("", true);
        },
        onPending: (action) => {
          pendingFromStream = action;
        },
      });

      if (sendGenerationRef.current !== generation) return;

      if (result.threadId) {
        if (
          activeThreadId !== result.threadId &&
          activeThreadId.startsWith("thread-")
        ) {
          const placeholder = getLocalAssistantThread(restaurantId, activeThreadId);
          if (placeholder) {
            upsertLocalAssistantThread(restaurantId, {
              ...placeholder,
              id: result.threadId,
            });
          }
        }
        activeThreadId = result.threadId;
        setThreadId(result.threadId);
      }

      const reply = result.error
        ? result.error
        : result.reply.trim() ||
          "Antwort fehlgeschlagen. Bitte erneut versuchen.";

      patchAssistant(reply, false);
      mirrorThreadLocal(
        activeThreadId,
        messagesRef.current,
        titleFromAssistantMessage(text),
      );

      const action = result.error
        ? null
        : (result.pendingAction ?? pendingFromStream);
      if (
        action?.kind === "create_reservation" ||
        action?.kind === "update_opening_hours" ||
        action?.kind === "confirm_mutation"
      ) {
        setPendingAction(action);
      }

      if (fromVoice && !result.error) speakReply(reply, dateLocale);
      void loadThreads();
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      if (sendGenerationRef.current !== generation) return;
      const errMsg =
        locale === "de"
          ? "Netzwerkfehler — bitte erneut versuchen."
          : "Network error — please try again.";
      patchAssistant(errMsg, false);
      mirrorThreadLocal(
        activeThreadId,
        messagesRef.current,
        titleFromAssistantMessage(text),
      );
      void loadThreads();
    } finally {
      if (sendGenerationRef.current === generation) {
        setSending(false);
        setStreamPhase(null);
        streamMsgIdRef.current = null;
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  }, [
    restaurantId,
    input,
    threadId,
    loadThreads,
    mirrorThreadLocal,
    zone,
    dateLocale,
    pendingAction,
    locale,
  ]);

  const confirmPending = useCallback(async () => {
    if (!restaurantId || !pendingAction) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          zone,
          kind: pendingAction.kind,
          preview: pendingAction.preview,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
        ask?: string | null;
      };
      const reply = json.reply?.trim() || json.ask || json.error || "Nicht gespeichert.";
      const next = [
        ...messagesRef.current,
        { id: newLocalId("msg"), role: "assistant" as const, content: reply },
      ];
      setMessages(next);
      if (threadId) {
        mirrorThreadLocal(threadId, next, titleFromAssistantMessage(reply));
      }
      if (!res.ok) throw new Error(reply);
      confirmedRef.current = true;
      setPendingAction(null);
      if (voiceTurnRef.current) speakReply(reply, dateLocale);
    } finally {
      setConfirming(false);
    }
  }, [restaurantId, pendingAction, zone, threadId, mirrorThreadLocal, dateLocale]);

  const cancelPending = useCallback(() => {
    const reply = locale === "de" ? "Abgebrochen. Es wurde nichts gespeichert." : "Cancelled. Nothing was saved.";
    const next = [
      ...messagesRef.current,
      { id: newLocalId("msg"), role: "assistant" as const, content: reply },
    ];
    setMessages(next);
    if (threadId) mirrorThreadLocal(threadId, next, titleFromAssistantMessage(reply));
    setPendingAction(null);
    if (voiceTurnRef.current) speakReply(reply, dateLocale);
  }, [locale, threadId, mirrorThreadLocal, dateLocale]);

  const toggleVoice = useCallback(() => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor || sending) return;
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = dateLocale;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) void send(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [dateLocale, listening, sending, send]);

  useEffect(() => {
    if (open) return;
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const toggleHistory = useCallback(() => {
    setShowHistory((v) => !v);
    void loadThreads();
  }, [loadThreads]);

  if (!mounted || !ready || !restaurantId) return null;

  const chatProps = {
    locale,
    dateLocale,
    zone: zone as "superadmin" | "restaurant",
    messages,
    threads,
    threadId,
    showHistory,
    loadingThread,
    bootError,
    sending,
    streamPhase,
    input,
    listening,
    canSpeakInput,
    listRef,
    inputRef,
    onInputChange: setInput,
    onSend: () => void send(),
    onToggleVoice: toggleVoice,
    onToggleHistory: toggleHistory,
    onNewChat: startNewChat,
    onClose: close,
    onLoadThread: (id: string) => void loadThread(id),
  };

  const confirmDialog = (
    <ConfirmDialog
      open={pendingAction != null}
      onOpenChange={(next) => {
        if (next) return;
        if (confirmedRef.current) {
          confirmedRef.current = false;
          return;
        }
        if (suppressCancelRef.current) {
          suppressCancelRef.current = false;
          return;
        }
        cancelPending();
      }}
      title={locale === "de" ? "Jetzt umsetzen?" : "Apply now?"}
      description={pendingAction?.summary}
      confirmLabel={locale === "de" ? "Umsetzen" : "Apply"}
      cancelLabel={locale === "de" ? "Abbrechen" : "Cancel"}
      destructive={false}
      confirmDisabled={confirming}
      onConfirm={confirmPending}
    />
  );

  if (isMobile) {
    return createPortal(
      <>
        {/* FAB bleibt klickbar wenn Sheet zu; unter dem Sheet versteckt wenn offen */}
        {!open ? (
          <div
            className={cn(
              "pointer-events-none fixed flex flex-col items-end gap-3",
              appMobileAssistantFabEndClassName,
              appMobileFabBottomClassName,
            )}
            style={{ zIndex: APP_LAYER_Z_INDEX.fab + 1 }}
            data-dashboard-assistant-fab
          >
            <motion.button
              type="button"
              className={cn(
                "pointer-events-auto",
                appMobileFabButtonClassName,
                brandActionButtonClassName,
              )}
              aria-label="Assistent öffnen"
              aria-expanded={false}
              onClick={() => setOpen(true)}
              whileTap={{ scale: 0.94 }}
            >
              <Sparkles className={appMobileFabIconClassName} />
            </motion.button>
          </div>
        ) : null}
        <AppMobileChromeScreen
          open={open}
          onClose={close}
          title="Assistent"
          aria-label="Gwada Assistent"
          className={keyboardInset > 0 ? "pb-0" : undefined}
          headerAction={
            <AssistantChatHeaderActions
              onToggleHistory={toggleHistory}
              onNewChat={startNewChat}
              onClose={close}
            />
          }
        >
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={
              keyboardInset > 0
                ? { paddingBottom: keyboardInset }
                : undefined
            }
          >
            <AssistantChatPanel variant="mobile" {...chatProps} />
          </div>
        </AppMobileChromeScreen>
        {confirmDialog}
      </>,
      document.body,
    );
  }

  const panel = (
    <div
      className={cn(
        "pointer-events-none fixed flex flex-col items-end gap-3",
        appMobileAssistantFabEndClassName,
        appMobileFabBottomClassName,
      )}
      style={{ zIndex: APP_LAYER_Z_INDEX.fab + 1 }}
      data-dashboard-assistant-fab
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            key="assistant-panel"
            initial={{ opacity: 0, y: 16, scale: 0.92, originX: 1, originY: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto flex h-[min(34rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl"
            role="dialog"
            aria-label="Gwada Assistent"
          >
            <AssistantChatPanel variant="desktop" {...chatProps} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        className={cn(
          "pointer-events-auto",
          appMobileFabButtonClassName,
          brandActionButtonClassName,
        )}
        aria-label={open ? "Assistent schließen" : "Assistent öffnen"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.94 }}
      >
        {open ? (
          <X className={appMobileFabIconClassName} />
        ) : (
          <Sparkles className={appMobileFabIconClassName} />
        )}
      </motion.button>
    </div>
  );

  return createPortal(
    <>
      {panel}
      {confirmDialog}
    </>,
    document.body,
  );
}
