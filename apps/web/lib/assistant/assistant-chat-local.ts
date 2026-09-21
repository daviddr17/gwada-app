/**
 * Client-side mirror for assistant chat threads.
 * Keeps Verlauf usable when DB persist is ephemeral / schema-cache unavailable.
 */

export type AssistantLocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type AssistantLocalThread = {
  id: string;
  title: string;
  updated_at: string;
  messages: AssistantLocalMessage[];
};

const STORAGE_PREFIX = "gwada-assistant-threads-v1:";

function storageKey(restaurantId: string): string {
  return `${STORAGE_PREFIX}${restaurantId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readLocalAssistantThreads(
  restaurantId: string,
): AssistantLocalThread[] {
  if (!canUseStorage() || !restaurantId) return [];
  try {
    const raw = localStorage.getItem(storageKey(restaurantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is AssistantLocalThread =>
          !!t &&
          typeof t === "object" &&
          typeof (t as AssistantLocalThread).id === "string" &&
          Array.isArray((t as AssistantLocalThread).messages),
      )
      .map((t) => ({
        id: t.id,
        title: typeof t.title === "string" ? t.title : "Chat",
        updated_at:
          typeof t.updated_at === "string"
            ? t.updated_at
            : new Date().toISOString(),
        messages: t.messages
          .filter(
            (m): m is AssistantLocalMessage =>
              !!m &&
              typeof m === "object" &&
              typeof m.id === "string" &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string",
          )
          .slice(-200),
      }))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
      .slice(0, 40);
  } catch {
    return [];
  }
}

function writeLocalAssistantThreads(
  restaurantId: string,
  threads: AssistantLocalThread[],
): void {
  if (!canUseStorage() || !restaurantId) return;
  try {
    localStorage.setItem(
      storageKey(restaurantId),
      JSON.stringify(threads.slice(0, 40)),
    );
  } catch {
    /* quota / private mode */
  }
}

export function getLocalAssistantThread(
  restaurantId: string,
  threadId: string,
): AssistantLocalThread | null {
  return (
    readLocalAssistantThreads(restaurantId).find((t) => t.id === threadId) ??
    null
  );
}

export function upsertLocalAssistantThread(
  restaurantId: string,
  thread: AssistantLocalThread,
): void {
  if (!restaurantId || !thread.id) return;
  const existing = readLocalAssistantThreads(restaurantId).filter(
    (t) => t.id !== thread.id,
  );
  writeLocalAssistantThreads(restaurantId, [
    {
      ...thread,
      title: thread.title.trim().slice(0, 80) || "Chat",
      messages: thread.messages.slice(-200),
      updated_at: thread.updated_at || new Date().toISOString(),
    },
    ...existing,
  ]);
}

export function titleFromAssistantMessage(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "Chat";
  return t.length > 48 ? `${t.slice(0, 45)}…` : t;
}

/** Merge server + local lists; newer `updated_at` wins per id. */
export function mergeAssistantThreadLists(
  server: Array<{ id: string; title: string; updated_at: string }>,
  local: AssistantLocalThread[],
): Array<{ id: string; title: string; updated_at: string }> {
  const map = new Map<string, { id: string; title: string; updated_at: string }>();
  for (const t of local) {
    map.set(t.id, {
      id: t.id,
      title: t.title || "Chat",
      updated_at: t.updated_at,
    });
  }
  for (const t of server) {
    const prev = map.get(t.id);
    if (!prev || (t.updated_at ?? "") >= (prev.updated_at ?? "")) {
      map.set(t.id, {
        id: t.id,
        title: t.title || prev?.title || "Chat",
        updated_at: t.updated_at,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.updated_at < b.updated_at ? 1 : -1,
  );
}
