"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  History,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import {
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
};

function newLocalId() {
  return `local-${Math.random().toString(36).slice(2, 10)}`;
}

export function DashboardAssistantMount() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  }, [messages, open, sending]);

  const loadThreads = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await fetch(
        `/api/assistant/threads?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      const json = (await res.json().catch(() => ({}))) as {
        threads?: Thread[];
        error?: string;
      };
      if (!res.ok) {
        setBootError(json.error ?? "Chats konnten nicht geladen werden.");
        return;
      }
      setBootError(null);
      setThreads(json.threads ?? []);
    } catch {
      setBootError("Chats konnten nicht geladen werden.");
    }
  }, [restaurantId]);

  const loadThread = useCallback(
    async (id: string) => {
      if (!restaurantId) return;
      setLoadingThread(true);
      try {
        const res = await fetch(
          `/api/assistant/threads/${encodeURIComponent(id)}?restaurantId=${encodeURIComponent(restaurantId)}`,
        );
        const json = (await res.json().catch(() => ({}))) as {
          messages?: Array<{ id: string; role: string; content: string }>;
          error?: string;
        };
        if (!res.ok) {
          setBootError(json.error ?? "Chat konnte nicht geladen werden.");
          return;
        }
        setThreadId(id);
        setMessages(
          (json.messages ?? [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
        );
        setShowHistory(false);
      } finally {
        setLoadingThread(false);
      }
    },
    [restaurantId],
  );

  useEffect(() => {
    if (!open || !restaurantId) return;
    void loadThreads();
  }, [open, restaurantId, loadThreads]);

  const startNewChat = useCallback(() => {
    setThreadId(null);
    setMessages([]);
    setShowHistory(false);
    setBootError(null);
  }, []);

  const send = useCallback(async () => {
    if (!restaurantId || sending) return;
    const text = input.trim();
    if (!text) return;

    setInput("");
    setSending(true);
    setBootError(null);
    const userLocal: ChatMessage = {
      id: newLocalId(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userLocal]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          threadId,
          message: text,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        threadId?: string;
        reply?: string;
        error?: string;
        configured?: boolean;
      };

      const reply =
        json.reply?.trim() ||
        json.error ||
        "Antwort fehlgeschlagen. Bitte erneut versuchen.";

      if (json.threadId) {
        setThreadId(json.threadId);
      }

      setMessages((prev) => [
        ...prev,
        { id: newLocalId(), role: "assistant", content: reply },
      ]);
      void loadThreads();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: newLocalId(),
          role: "assistant",
          content: "Netzwerkfehler — bitte erneut versuchen.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [restaurantId, sending, input, threadId, loadThreads]);

  if (!mounted || !ready || !restaurantId) return null;

  const panel = (
    <div
      className={cn(
        "pointer-events-none fixed end-4 flex flex-col items-end gap-3 sm:end-6",
        appMobileFabBottomClassName,
      )}
      style={{ zIndex: APP_LAYER_Z_INDEX.fab }}
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
                      <li>„Wie lege ich Sonderöffnungszeiten an?“</li>
                      <li>„Reservierung für Samstag 19 Uhr, 4 Personen …“</li>
                    </ul>
                  </div>
                ) : null}
                {messages.map((m) => (
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
                  </div>
                ))}
                {sending ? (
                  <div className="me-auto flex items-center gap-2 rounded-2xl border border-border/50 bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="size-3.5 animate-spin" />
                    Denkt nach …
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
                              {new Date(t.updated_at).toLocaleString("de-DE", {
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
                disabled={sending}
              />
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "size-10 shrink-0 rounded-full",
                  brandActionButtonClassName,
                )}
                disabled={sending || !input.trim()}
                aria-label="Senden"
              >
                {sending ? (
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
          <MessageCircle className={appMobileFabIconClassName} />
        )}
      </motion.button>
    </div>
  );

  return createPortal(panel, document.body);
}
