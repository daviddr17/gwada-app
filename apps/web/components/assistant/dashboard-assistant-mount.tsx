"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  History,
  Loader2,
  Mic,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantPendingAction } from "@/lib/assistant/assistant-actions";
import { consumeAssistantChatStream } from "@/lib/assistant/assistant-chat-stream-client";
import type { AssistantSsePhase } from "@/lib/assistant/assistant-chat-sse";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isSuperadminAppPath } from "@/lib/superadmin/superadmin-session";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  getLocalAssistantThread,
  mergeAssistantThreadLists,
  readLocalAssistantThreads,
  titleFromAssistantMessage,
  upsertLocalAssistantThread,
} from "@/lib/assistant/assistant-chat-local";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
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

type Thread = {
  id: string;
  title: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

function typingLabel(phase: AssistantSsePhase | null, locale: string): string {
  if (locale !== "de") {
    if (phase === "tools") return "Working…";
    return "Typing…";
  }
  if (phase === "tools") return "arbeitet …";
  return "schreibt …";
}

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

export function DashboardAssistantMount() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const pathname = usePathname();
  const zone = isSuperadminAppPath(pathname) ? "superadmin" : "restaurant";
  const locale = normalizeAppLocale(useLocale());
  const dateLocale = APP_LOCALE_TO_PROFILE[locale];
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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(t);
  }, [open, threadId]);

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

  if (!mounted || !ready || !restaurantId) return null;

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
            <header className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-accent-foreground">
                <Sparkles className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Assistent</p>
                <p className="truncate text-xs text-muted-foreground">
                  Fragen, Stats &amp; Aktionen
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                aria-label="Verlauf"
                onClick={() => {
                  setShowHistory((v) => !v);
                  void loadThreads();
                }}
              >
                <History className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                aria-label="Neuer Chat"
                onClick={startNewChat}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                aria-label="Schließen"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </header>

            <div className="relative min-h-0 flex-1">
              <div
                ref={listRef}
                className="h-full space-y-3 overflow-y-auto px-3 py-3"
              >
                {messages.length === 0 && !loadingThread ? (
                  <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Hallo — wie kann ich helfen?</p>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>„Wie viele Reservierungen nächste Woche?“</li>
                      <li>„Wann haben wir geöffnet?“</li>
                      <li>„Wie lege ich Sonderöffnungszeiten an?“</li>
                    </ul>
                    <p className="pt-1 text-xs leading-relaxed">
                      {zone === "superadmin"
                        ? "Offline: Stats, Öffnungszeiten und Handbuch. Mit dem Schlüssel unter Integrationen mehr Dialoge und Aktionen."
                        : "Offline: Stats, Öffnungszeiten und Handbuch. Mit eigenem Schlüssel unter Einstellungen → Integrationen mehr Dialoge und Aktionen."}
                    </p>
                  </div>
                ) : null}
                {messages.map((m) => {
                  if (m.role === "assistant" && m.streaming && !m.content.trim()) {
                    return null;
                  }
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        m.role === "user"
                          ? "ms-auto bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] text-foreground"
                          : "me-auto border border-border/50 bg-card text-foreground shadow-sm",
                      )}
                    >
                      {m.content}
                      {m.streaming && m.content.trim() ? (
                        <span
                          className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-foreground/70"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  );
                })}
                {sending &&
                !messages.some((m) => m.streaming && m.content.trim()) ? (
                  <div
                    className="me-auto flex items-center gap-2 rounded-2xl border border-border/50 bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm"
                    aria-live="polite"
                  >
                    <span className="flex gap-1" aria-hidden>
                      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/80" />
                      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/55 [animation-delay:150ms]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/35 [animation-delay:300ms]" />
                    </span>
                    {typingLabel(streamPhase, locale)}
                  </div>
                ) : null}
                {bootError ? (
                  <p className="text-xs text-destructive">{bootError}</p>
                ) : null}
              </div>

              <AnimatePresence>
                {showHistory ? (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="absolute inset-0 z-10 flex flex-col bg-background/95 backdrop-blur-sm"
                  >
                    <div className="border-b border-border/50 px-3 py-2 text-sm font-medium">
                      Verlauf
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                      {threads.length === 0 ? (
                        <p className="px-2 py-4 text-sm text-muted-foreground">
                          Noch keine Chats.
                        </p>
                      ) : (
                        threads.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={cn(
                              "mb-1 w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted/60",
                              t.id === threadId && "bg-muted/80",
                            )}
                            onClick={() => void loadThread(t.id)}
                          >
                            <span className="line-clamp-2 font-medium">
                              {t.title || "Chat"}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {new Date(t.updated_at).toLocaleString(dateLocale, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <form
              className="flex items-end gap-2 border-t border-border/50 p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                placeholder="Nachricht …"
                className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              {canSpeakInput ? (
                <Button
                  type="button"
                  size="icon"
                  variant={listening ? "default" : "outline"}
                  className="size-10 shrink-0 rounded-full"
                  aria-label={listening ? "Zuhören beenden" : "Sprechen"}
                  aria-pressed={listening}
                  disabled={sending}
                  onClick={toggleVoice}
                >
                  <Mic className="size-4" />
                </Button>
              ) : null}
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "size-10 shrink-0 rounded-full",
                  brandActionButtonClassName,
                )}
                disabled={!input.trim()}
                aria-label={sending ? "Senden (bricht laufende Antwort ab)" : "Senden"}
              >
                {sending && !input.trim() ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
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
    </>,
    document.body,
  );
}
