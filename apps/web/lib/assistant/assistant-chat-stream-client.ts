import type { AssistantPendingAction } from "@/lib/assistant/assistant-actions";
import {
  pushAssistantSseBuffer,
  type AssistantSseEvent,
  type AssistantSsePhase,
} from "@/lib/assistant/assistant-chat-sse";

export type AssistantStreamHandlers = {
  onMeta?: (ev: Extract<AssistantSseEvent, { type: "meta" }>) => void;
  onStatus?: (phase: AssistantSsePhase) => void;
  onDelta?: (text: string) => void;
  onReset?: () => void;
  onPending?: (pendingAction: AssistantPendingAction) => void;
  onDone?: (ev: Extract<AssistantSseEvent, { type: "done" }>) => void;
  onError?: (error: string, configured: boolean) => void;
};

export type AssistantStreamResult = {
  reply: string;
  threadId: string | null;
  configured: boolean;
  mode: "llm" | "offline";
  pendingAction: AssistantPendingAction | null;
  ephemeral: boolean;
  error: string | null;
};

function dispatchAssistantSseEvent(
  ev: AssistantSseEvent,
  handlers: AssistantStreamHandlers,
  acc: {
    reply: string;
    threadId: string | null;
    configured: boolean;
    mode: "llm" | "offline";
    pendingAction: AssistantPendingAction | null;
    ephemeral: boolean;
    error: string | null;
  },
): void {
  switch (ev.type) {
    case "meta":
      acc.threadId = ev.threadId;
      acc.configured = ev.configured;
      acc.mode = ev.mode;
      handlers.onMeta?.(ev);
      break;
    case "status":
      handlers.onStatus?.(ev.phase);
      break;
    case "delta":
      acc.reply += ev.text;
      handlers.onDelta?.(ev.text);
      break;
    case "reset":
      acc.reply = "";
      handlers.onReset?.();
      break;
    case "pending":
      acc.pendingAction = ev.pendingAction;
      handlers.onPending?.(ev.pendingAction);
      break;
    case "done":
      acc.reply = ev.reply || acc.reply;
      acc.threadId = ev.threadId ?? acc.threadId;
      acc.configured = ev.configured;
      acc.mode = ev.mode;
      acc.pendingAction = ev.pendingAction;
      acc.ephemeral = ev.ephemeral;
      handlers.onDone?.(ev);
      break;
    case "error":
      acc.error = ev.error;
      acc.configured = ev.configured;
      handlers.onError?.(ev.error, ev.configured);
      break;
    default:
      break;
  }
}

/** Consume `/api/assistant/chat` SSE (or JSON error fallback). */
export async function consumeAssistantChatStream(
  res: Response,
  handlers: AssistantStreamHandlers = {},
): Promise<AssistantStreamResult> {
  const acc: AssistantStreamResult = {
    reply: "",
    threadId: null,
    configured: true,
    mode: "llm",
    pendingAction: null,
    ephemeral: false,
    error: null,
  };

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      reply?: string;
      threadId?: string | null;
      configured?: boolean;
      pendingAction?: AssistantPendingAction | null;
      ephemeral?: boolean;
      mode?: "llm" | "offline";
    };
    if (!res.ok || json.error) {
      const error = json.error || json.reply || `HTTP ${res.status}`;
      acc.error = error;
      acc.configured = json.configured ?? true;
      handlers.onError?.(error, acc.configured);
      return acc;
    }
    acc.reply = json.reply?.trim() ?? "";
    acc.threadId = json.threadId ?? null;
    acc.configured = json.configured ?? true;
    acc.mode = json.mode ?? "llm";
    acc.pendingAction = json.pendingAction ?? null;
    acc.ephemeral = json.ephemeral ?? false;
    if (acc.reply) handlers.onDelta?.(acc.reply);
    if (acc.pendingAction) handlers.onPending?.(acc.pendingAction);
    handlers.onDone?.({
      type: "done",
      reply: acc.reply,
      threadId: acc.threadId,
      configured: acc.configured,
      mode: acc.mode,
      pendingAction: acc.pendingAction,
      ephemeral: acc.ephemeral,
    });
    return acc;
  }

  if (!res.body) {
    acc.error = "Leerer Stream.";
    handlers.onError?.(acc.error, true);
    return acc;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const { events, rest } = pushAssistantSseBuffer(
      buffer,
      decoder.decode(value, { stream: true }),
    );
    buffer = rest;
    for (const ev of events) {
      dispatchAssistantSseEvent(ev, handlers, acc);
    }
  }

  if (buffer.trim()) {
    const { events } = pushAssistantSseBuffer(buffer, "\n\n");
    for (const ev of events) {
      dispatchAssistantSseEvent(ev, handlers, acc);
    }
  }

  if (!acc.error && !acc.reply.trim()) {
    acc.error = "Leere Assistenten-Antwort.";
    handlers.onError?.(acc.error, acc.configured);
  }

  return acc;
}
