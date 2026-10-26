"use client";

import { AnimatePresence, motion } from "framer-motion";
import { History, Loader2, Mic, Plus, Send, Sparkles, X } from "lucide-react";
import type { RefObject } from "react";
import type { AssistantSsePhase } from "@/lib/assistant/assistant-chat-sse";
import { Button } from "@/components/ui/button";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

export type AssistantChatThread = {
  id: string;
  title: string;
  updated_at: string;
};

function typingLabel(phase: AssistantSsePhase | null, locale: string): string {
  if (locale !== "de") {
    if (phase === "tools") return "Working…";
    return "Typing…";
  }
  if (phase === "tools") return "arbeitet …";
  return "schreibt …";
}

export function AssistantChatHeaderActions({
  onToggleHistory,
  onNewChat,
  onClose,
  showClose = true,
}: {
  onToggleHistory: () => void;
  onNewChat: () => void;
  onClose?: () => void;
  showClose?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="rounded-full"
        aria-label="Verlauf"
        onClick={onToggleHistory}
      >
        <History className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="rounded-full"
        aria-label="Neuer Chat"
        onClick={onNewChat}
      >
        <Plus className="size-4" />
      </Button>
      {showClose && onClose ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="rounded-full"
          aria-label="Schließen"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

type AssistantChatPanelProps = {
  variant: "desktop" | "mobile";
  locale: string;
  dateLocale: string;
  zone: "superadmin" | "restaurant";
  messages: AssistantChatMessage[];
  threads: AssistantChatThread[];
  threadId: string | null;
  showHistory: boolean;
  loadingThread: boolean;
  bootError: string | null;
  sending: boolean;
  streamPhase: AssistantSsePhase | null;
  input: string;
  listening: boolean;
  canSpeakInput: boolean;
  listRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onToggleVoice: () => void;
  onToggleHistory: () => void;
  onNewChat: () => void;
  onClose: () => void;
  onLoadThread: (id: string) => void;
};

/**
 * Gemeinsamer Chat-Inhalt (Messages, Verlauf, Composer).
 * Desktop: inkl. Floating-Header. Mobile: Header kommt von AppMobileChromeScreen.
 */
export function AssistantChatPanel({
  variant,
  locale,
  dateLocale,
  zone,
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
  onInputChange,
  onSend,
  onToggleVoice,
  onToggleHistory,
  onNewChat,
  onClose,
  onLoadThread,
}: AssistantChatPanelProps) {
  const messagesBlock = (
    <div className="relative min-h-0 flex-1">
      <div
        ref={listRef}
        className="h-full space-y-3 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {messages.length === 0 && !loadingThread ? (
          <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Hallo — wie kann ich helfen?
            </p>
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
                    onClick={() => onLoadThread(t.id)}
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
  );

  const composer = (
    <form
      className="flex shrink-0 items-end gap-2 border-t border-border/50 p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        rows={1}
        placeholder="Nachricht …"
        enterKeyHint="send"
        autoComplete="off"
        className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onFocus={(e) => {
          if (variant !== "mobile") return;
          const el = e.currentTarget;
          requestAnimationFrame(() => {
            el.scrollIntoView({ block: "nearest", inline: "nearest" });
          });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
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
          onClick={onToggleVoice}
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
        aria-label={
          sending ? "Senden (bricht laufende Antwort ab)" : "Senden"
        }
      >
        {sending && !input.trim() ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
      </Button>
    </form>
  );

  if (variant === "mobile") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {messagesBlock}
        {composer}
      </div>
    );
  }

  return (
    <>
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
        <AssistantChatHeaderActions
          onToggleHistory={onToggleHistory}
          onNewChat={onNewChat}
          onClose={onClose}
        />
      </header>
      {messagesBlock}
      {composer}
    </>
  );
}
