import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AssistantThreadRow = {
  id: string;
  restaurant_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AssistantMessageRow = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_name: string | null;
  tool_call_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listAssistantThreads(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<AssistantThreadRow[]> {
  const { data, error } = await sb
    .from("assistant_chat_threads")
    .select("id, restaurant_id, user_id, title, created_at, updated_at")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []) as AssistantThreadRow[];
}

export async function createAssistantThread(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
  title = "Neuer Chat",
): Promise<AssistantThreadRow> {
  const { data, error } = await sb
    .from("assistant_chat_threads")
    .insert({
      restaurant_id: restaurantId,
      user_id: userId,
      title,
    })
    .select("id, restaurant_id, user_id, title, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as AssistantThreadRow;
}

export async function getAssistantThreadForUser(
  sb: SupabaseClient,
  threadId: string,
  userId: string,
): Promise<AssistantThreadRow | null> {
  const { data, error } = await sb
    .from("assistant_chat_threads")
    .select("id, restaurant_id, user_id, title, created_at, updated_at")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AssistantThreadRow | null) ?? null;
}

export async function listAssistantMessages(
  sb: SupabaseClient,
  threadId: string,
): Promise<AssistantMessageRow[]> {
  const { data, error } = await sb
    .from("assistant_chat_messages")
    .select(
      "id, thread_id, role, content, tool_name, tool_call_id, metadata, created_at",
    )
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as AssistantMessageRow[];
}

export async function insertAssistantMessage(
  sb: SupabaseClient,
  input: {
    threadId: string;
    role: AssistantMessageRow["role"];
    content: string;
    toolName?: string | null;
    toolCallId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<AssistantMessageRow> {
  const { data, error } = await sb
    .from("assistant_chat_messages")
    .insert({
      thread_id: input.threadId,
      role: input.role,
      content: input.content,
      tool_name: input.toolName ?? null,
      tool_call_id: input.toolCallId ?? null,
      metadata: input.metadata ?? {},
    })
    .select(
      "id, thread_id, role, content, tool_name, tool_call_id, metadata, created_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return data as AssistantMessageRow;
}

export async function touchAssistantThread(
  sb: SupabaseClient,
  threadId: string,
  title?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (title?.trim()) patch.title = title.trim().slice(0, 80);
  const { error } = await sb
    .from("assistant_chat_threads")
    .update(patch)
    .eq("id", threadId);
  if (error) throw new Error(error.message);
}

export function titleFromUserMessage(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "Neuer Chat";
  return t.length > 48 ? `${t.slice(0, 45)}…` : t;
}
