import type { AssistantPendingAction } from "@/lib/assistant/assistant-actions";

export type AssistantSsePhase = "thinking" | "tools" | "writing";

export type AssistantSseEvent =
  | {
      type: "meta";
      threadId: string | null;
      configured: boolean;
      mode: "llm" | "offline";
    }
  | { type: "status"; phase: AssistantSsePhase }
  | { type: "delta"; text: string }
  /** Clear in-progress assistant text (e.g. model switched to tool calls). */
  | { type: "reset" }
  | { type: "pending"; pendingAction: AssistantPendingAction }
  | {
      type: "done";
      reply: string;
      threadId: string | null;
      configured: boolean;
      mode: "llm" | "offline";
      pendingAction: AssistantPendingAction | null;
      ephemeral: boolean;
    }
  | { type: "error"; error: string; configured: boolean };

export function encodeAssistantSse(event: AssistantSseEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function parseAssistantSseBlock(block: string): AssistantSseEvent | null {
  const lines = block.split("\n");
  let eventName = "";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!dataLines.length) return null;
  try {
    const parsed = JSON.parse(dataLines.join("\n")) as AssistantSseEvent;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return null;
    if (eventName && parsed.type !== eventName) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Incremental SSE parser for fetch ReadableStream chunks. */
export function pushAssistantSseBuffer(
  buffer: string,
  chunk: string,
): { events: AssistantSseEvent[]; rest: string } {
  const combined = buffer + chunk;
  const parts = combined.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: AssistantSseEvent[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const ev = parseAssistantSseBlock(trimmed);
    if (ev) events.push(ev);
  }
  return { events, rest };
}
