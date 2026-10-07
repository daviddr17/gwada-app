import { pickAssistantLlm } from "@/lib/assistant/assistant-llm-source";
import { streamAssistantChatTurn } from "@/lib/assistant/assistant-chat-stream";
import { encodeAssistantSse } from "@/lib/assistant/assistant-chat-sse";
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

  const zone = body.zone === "superadmin" ? "superadmin" : "restaurant";

  const runtimePromise = (async () => {
    const [{ data: restaurant }, timeZone, localeRaw, superSession] = await Promise.all([
      auth.sb
        .from("restaurants")
        .select("name")
        .eq("id", auth.restaurantId)
        .maybeSingle(),
      fetchRestaurantTimezoneServer(auth.sb, auth.restaurantId),
      getLocale().catch(() => "de"),
      zone === "superadmin" ? getSuperadminSession(auth.sb) : Promise.resolve(null),
    ]);
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
    return {
      restaurantName: restaurant?.name ?? null,
      timeZone,
      locale: normalizeAppLocale(localeRaw),
      callerIsSuperadmin,
      usePlatform,
      llm,
    };
  })();

  let persist = true;
  let thread: AssistantThreadRow | null = null;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let persistUserPromise: Promise<void> | null = null;

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

    const isFirst = history.length === 0;
    const threadIdForPersist = thread.id;
    persistUserPromise = (async () => {
      await insertAssistantMessage(auth.sb, {
        threadId: threadIdForPersist,
        role: "user",
        content: message,
      });
      await touchAssistantThread(
        auth.sb,
        threadIdForPersist,
        isFirst ? titleFromUserMessage(message) : undefined,
      );
    })();
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
    persistUserPromise = null;
  }

  const encoder = new TextEncoder();
  const signal = req.signal;

  const bodyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Parameters<typeof encodeAssistantSse>[0]) => {
        controller.enqueue(encoder.encode(encodeAssistantSse(event)));
      };

      try {
        const runtime = await runtimePromise;
        const configured = Boolean(runtime.llm?.apiKey);
        send({
          type: "meta",
          threadId: thread?.id ?? null,
          configured,
          mode: configured ? "llm" : "offline",
        });

        const result = await streamAssistantChatTurn({
          ctx: {
            restaurantId: auth.restaurantId,
            userId: auth.userId,
            sb: auth.sb,
            zone,
            callerIsSuperadmin: runtime.callerIsSuperadmin,
          },
          history,
          userMessage: message,
          restaurantName: runtime.restaurantName,
          timeZone: runtime.timeZone,
          locale: runtime.locale,
          llm: runtime.llm,
          keyAudience: runtime.usePlatform ? "superadmin" : "restaurant",
          signal,
          onEvent: (event) => {
            if (event.type === "done" || event.type === "error" || event.type === "meta") {
              return;
            }
            send(event);
          },
        });

        if (persistUserPromise) {
          try {
            await persistUserPromise;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "persist_failed";
            if (!isAssistantPersistenceUnavailable(msg)) {
              console.warn("[assistant] chat persist user (deferred)", msg);
            } else {
              persist = false;
            }
          }
        }

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
          send({
            type: "error",
            error: result.error,
            configured: result.configured,
          });
          return;
        }

        if (persist && thread) {
          try {
            await insertAssistantMessage(auth.sb, {
              threadId: thread.id,
              role: "assistant",
              content: result.reply,
              metadata: { configured: result.configured, mode: result.mode },
            });
            await touchAssistantThread(auth.sb, thread.id);
            send({
              type: "done",
              reply: result.reply,
              threadId: thread.id,
              configured: result.configured,
              mode: result.mode,
              pendingAction: result.pendingAction,
              ephemeral: false,
            });
            return;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "persist_failed";
            console.warn("[assistant] chat persist reply", msg);
          }
        }

        send({
          type: "done",
          reply: result.reply,
          threadId: thread?.id ?? null,
          configured: result.configured,
          mode: result.mode,
          pendingAction: result.pendingAction,
          ephemeral: true,
        });
      } catch (e) {
        if ((e as Error)?.name === "AbortError" || signal.aborted) {
          return;
        }
        const msg = e instanceof Error ? e.message : "chat_failed";
        console.warn("[assistant] chat stream", msg);
        send({ type: "error", error: msg, configured: true });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(bodyStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
