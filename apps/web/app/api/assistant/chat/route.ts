import { pickAssistantLlm } from "@/lib/assistant/assistant-llm-source";
import { runAssistantChatTurn } from "@/lib/assistant/assistant-chat-server";
import {
  getAssistantThreadForUser,
  insertAssistantMessage,
  listAssistantMessages,
  titleFromUserMessage,
  touchAssistantThread,
  createAssistantThread,
  type AssistantThreadRow,
} from "@/lib/assistant/assistant-chat-db";
import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { fetchPlatformOpenaiConfigAdmin } from "@/lib/supabase/platform-openai-secrets-db";
import { fetchRestaurantAssistantRuntime } from "@/lib/supabase/restaurant-assistant-key-db";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { getSuperadminSession } from "@/lib/superadmin/superadmin-session";
import { getLocale } from "next-intl/server";
import { normalizeAppLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

function isAssistantPersistenceUnavailable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("assistant_chat_") ||
    m.includes("schema cache") ||
    m.includes("does not exist") ||
    m.includes("pgrst205")
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    threadId?: string | null;
    message?: string;
    zone?: string;
  };

  const message = body.message?.trim() ?? "";
  if (!message) {
    return Response.json({ error: "empty_message" }, { status: 400 });
  }
  if (message.length > 4000) {
    return Response.json({ error: "message_too_long" }, { status: 400 });
  }

  const auth = await authorizeDashboardRestaurant(body.restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let persist = true;
  let thread: AssistantThreadRow | null = null;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];

  try {
    const threadId = body.threadId?.trim() || null;
    if (threadId) {
      thread = await getAssistantThreadForUser(auth.sb, threadId, auth.userId);
      if (thread && thread.restaurant_id !== auth.restaurantId) {
        return Response.json({ error: "not_found" }, { status: 404 });
      }
    }

    if (!thread) {
      thread = await createAssistantThread(
        auth.sb,
        auth.restaurantId,
        auth.userId,
        titleFromUserMessage(message),
      );
    }

    const existing = await listAssistantMessages(auth.sb, thread.id);
    history = existing
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    await insertAssistantMessage(auth.sb, {
      threadId: thread.id,
      role: "user",
      content: message,
    });

    const isFirst = history.length === 0;
    await touchAssistantThread(
      auth.sb,
      thread.id,
      isFirst ? titleFromUserMessage(message) : undefined,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "persist_failed";
    if (!isAssistantPersistenceUnavailable(msg)) {
      console.warn("[assistant] chat persist", msg);
      return Response.json({ error: msg }, { status: 500 });
    }
    console.warn("[assistant] chat ephemeral (no persist)", msg);
    persist = false;
    thread = null;
    history = [];
  }

  try {
    const [{ data: restaurant }, timeZone, localeRaw] = await Promise.all([
      auth.sb
        .from("restaurants")
        .select("name")
        .eq("id", auth.restaurantId)
        .maybeSingle(),
      fetchRestaurantTimezoneServer(auth.sb, auth.restaurantId),
      getLocale().catch(() => "de"),
    ]);

    const zone = body.zone === "superadmin" ? "superadmin" : "restaurant";
    const superSession =
      zone === "superadmin" ? await getSuperadminSession(auth.sb) : null;
    const callerIsSuperadmin = superSession?.status === "ok";
    const usePlatform = zone === "superadmin" && callerIsSuperadmin;
    const platformConfig = usePlatform ? await fetchPlatformOpenaiConfigAdmin() : null;
    const platform =
      platformConfig?.enabled && platformConfig.apiKey
        ? {
            apiKey: platformConfig.apiKey,
            model: platformConfig.model,
            provider: platformConfig.provider,
            ...(platformConfig.baseURL ? { baseURL: platformConfig.baseURL } : {}),
          }
        : null;
    const restaurantLlm = usePlatform
      ? null
      : await fetchRestaurantAssistantRuntime(auth.restaurantId);
    const llm = pickAssistantLlm({
      zone,
      callerIsSuperadmin,
      platform,
      restaurant: restaurantLlm,
    });

    const result = await runAssistantChatTurn({
      ctx: {
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        sb: auth.sb,
        zone,
        callerIsSuperadmin,
      },
      history,
      userMessage: message,
      restaurantName: restaurant?.name ?? null,
      timeZone,
      locale: normalizeAppLocale(localeRaw),
      llm,
      keyAudience: usePlatform ? "superadmin" : "restaurant",
    });

    if (!result.ok) {
      if (persist && thread) {
        try {
          await insertAssistantMessage(auth.sb, {
            threadId: thread.id,
            role: "assistant",
            content: result.error,
            metadata: { error: true, configured: result.configured },
          });
        } catch {
          /* ignore */
        }
      }
      return Response.json(
        {
          threadId: thread?.id ?? null,
          reply: result.error,
          configured: result.configured,
          error: result.error,
          pendingAction: null,
          ephemeral: !persist,
        },
        { status: result.status ?? 500 },
      );
    }

    if (persist && thread) {
      try {
        const assistantMsg = await insertAssistantMessage(auth.sb, {
          threadId: thread.id,
          role: "assistant",
          content: result.reply,
          metadata: { configured: result.configured, mode: result.mode },
        });
        await touchAssistantThread(auth.sb, thread.id);
        return Response.json({
          threadId: thread.id,
          reply: result.reply,
          message: assistantMsg,
          configured: result.configured,
          mode: result.mode,
          pendingAction: result.pendingAction,
          ephemeral: false,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "persist_failed";
        console.warn("[assistant] chat persist reply", msg);
      }
    }

    return Response.json({
      threadId: thread?.id ?? null,
      reply: result.reply,
      configured: result.configured,
      mode: result.mode,
      pendingAction: result.pendingAction,
      ephemeral: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "chat_failed";
    console.warn("[assistant] chat", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
