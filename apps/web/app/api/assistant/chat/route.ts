import { runAssistantChatTurn } from "@/lib/assistant/assistant-chat-server";
import {
  getAssistantThreadForUser,
  insertAssistantMessage,
  listAssistantMessages,
  titleFromUserMessage,
  touchAssistantThread,
  createAssistantThread,
} from "@/lib/assistant/assistant-chat-db";
import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    threadId?: string | null;
    message?: string;
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

  try {
    let threadId = body.threadId?.trim() || null;
    let thread = threadId
      ? await getAssistantThreadForUser(auth.sb, threadId, auth.userId)
      : null;

    if (thread && thread.restaurant_id !== auth.restaurantId) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    if (!thread) {
      thread = await createAssistantThread(
        auth.sb,
        auth.restaurantId,
        auth.userId,
        titleFromUserMessage(message),
      );
      threadId = thread.id;
    }

    const existing = await listAssistantMessages(auth.sb, thread.id);
    const history = existing
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

    const [{ data: restaurant }, timeZone] = await Promise.all([
      auth.sb
        .from("restaurants")
        .select("name")
        .eq("id", auth.restaurantId)
        .maybeSingle(),
      fetchRestaurantTimezoneServer(auth.sb, auth.restaurantId),
    ]);

    const result = await runAssistantChatTurn({
      ctx: {
        restaurantId: auth.restaurantId,
        userId: auth.userId,
        sb: auth.sb,
      },
      history,
      userMessage: message,
      restaurantName: restaurant?.name ?? null,
      timeZone,
    });

    if (!result.ok) {
      const errText = result.error;
      await insertAssistantMessage(auth.sb, {
        threadId: thread.id,
        role: "assistant",
        content: errText,
        metadata: { error: true, configured: result.configured },
      });
      return Response.json(
        {
          threadId: thread.id,
          reply: errText,
          configured: result.configured,
          error: result.error,
        },
        { status: result.status ?? 500 },
      );
    }

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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "chat_failed";
    console.warn("[assistant] chat", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
