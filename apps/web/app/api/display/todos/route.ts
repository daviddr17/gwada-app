import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  assertDisplayModuleAccess,
  assertDisplaySessionAccess,
} from "@/lib/display/display-auth-server";
import {
  completeDisplayTodo,
  deferDisplayTodo,
  displayActionToTrigger,
  displayTriggerBlocksProceed,
  getDisplayTodoBadgeSummary,
  getTodosForDisplayTrigger,
  isVisibleInDisplayTodoList,
  listDisplayTodosForStaff,
  mapDisplayTodoForClient,
  reopenDisplayTodo,
} from "@/lib/staff/staff-display-todos-server";
import type { StaffTodoDeferTrigger } from "@/lib/types/staff-todos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const url = new URL(request.url);
  const trigger = url.searchParams.get("trigger") as StaffTodoDeferTrigger | null;
  const badgeOnly = url.searchParams.get("badge_only") === "1";
  const prepare = url.searchParams.get("prepare") === "1";

  const needsTimeModule = Boolean(trigger) && trigger !== "pin_login";
  const access = needsTimeModule
    ? await assertDisplayModuleAccess(cookieStore, "time")
    : await assertDisplaySessionAccess(cookieStore);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (badgeOnly) {
    const summary = await getDisplayTodoBadgeSummary(admin, {
      restaurantId: access.restaurantId,
      staffId: access.staffId,
    });
    return NextResponse.json({
      badge_count: summary.count,
      badge_urgency: summary.urgency,
    });
  }

  if (trigger) {
    const todos = await getTodosForDisplayTrigger(admin, {
      restaurantId: access.restaurantId,
      staffId: access.staffId,
      trigger,
      prepareTrigger: prepare,
    });
    const blocks = displayTriggerBlocksProceed(todos, trigger);
    return NextResponse.json({ todos, blocks });
  }

  const todos = await listDisplayTodosForStaff(admin, {
    restaurantId: access.restaurantId,
    staffId: access.staffId,
  });
  const clientTodos = todos
    .map((t) => mapDisplayTodoForClient(t, access.staffId))
    .filter(isVisibleInDisplayTodoList);
  const badge_count = clientTodos.filter((t) => !t.done_for_staff).length;

  return NextResponse.json({ todos: clientTodos, badge_count });
}

type PostBody =
  | {
      action: "complete";
      todo_id: string;
      completed_by_staff_id?: string;
    }
  | {
      action: "reopen";
      todo_id: string;
    }
  | {
      action: "defer";
      todo_id: string;
      trigger: StaffTodoDeferTrigger;
      reason?: string | null;
    }
  | {
      action: "prepare_trigger";
      display_action: "clock_in" | "start_break" | "end_break" | "clock_out";
    }
  | {
      action: "prepare_pin_login";
    };

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const needsTimeModule =
    body.action === "prepare_trigger" ||
    (body.action === "defer" && body.trigger !== "pin_login");

  const access = needsTimeModule
    ? await assertDisplayModuleAccess(cookieStore, "time")
    : await assertDisplaySessionAccess(cookieStore);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (body.action === "complete") {
    const result = await completeDisplayTodo(admin, {
      restaurantId: access.restaurantId,
      staffId: access.staffId,
      todoId: body.todo_id,
      completedByStaffId: body.completed_by_staff_id ?? access.staffId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reopen") {
    const result = await reopenDisplayTodo(admin, {
      restaurantId: access.restaurantId,
      staffId: access.staffId,
      todoId: body.todo_id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "defer") {
    const result = await deferDisplayTodo(admin, {
      restaurantId: access.restaurantId,
      staffId: access.staffId,
      todoId: body.todo_id,
      trigger: body.trigger,
      reason: body.reason,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "prepare_pin_login") {
    const todos = await getTodosForDisplayTrigger(admin, {
      restaurantId: access.restaurantId,
      staffId: access.staffId,
      trigger: "pin_login",
      prepareTrigger: true,
    });
    return NextResponse.json({ todos, blocks: false });
  }

  if (body.action === "prepare_trigger") {
    const trigger = displayActionToTrigger(body.display_action);
    const todos = await getTodosForDisplayTrigger(admin, {
      restaurantId: access.restaurantId,
      staffId: access.staffId,
      trigger,
      prepareTrigger: true,
    });
    return NextResponse.json({
      todos,
      blocks: displayTriggerBlocksProceed(todos, trigger),
    });
  }

  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}
