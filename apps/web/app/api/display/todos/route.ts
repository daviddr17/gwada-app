import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import {
  completeDisplayTodo,
  deferDisplayTodo,
  displayActionToTrigger,
  displayTriggerBlocksProceed,
  getDisplayTodoBadgeCount,
  getTodosForDisplayTrigger,
  listDisplayTodosForStaff,
} from "@/lib/staff/staff-display-todos-server";
import type { StaffTodoDeferTrigger } from "@/lib/types/staff-todos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "time");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(request.url);
  const badgeOnly = url.searchParams.get("badge_only") === "1";
  const trigger = url.searchParams.get("trigger") as StaffTodoDeferTrigger | null;
  const prepare = url.searchParams.get("prepare") === "1";

  if (badgeOnly) {
    const count = await getDisplayTodoBadgeCount(admin, {
      restaurantId: access.restaurantId,
      staffId: access.staffId,
    });
    return NextResponse.json({ badge_count: count });
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
  const badge_count = todos.filter(
    (t) => t.status !== "done" && t.status !== "archived" && t.status !== "planned",
  ).length;

  return NextResponse.json({ todos, badge_count });
}

type PostBody =
  | {
      action: "complete";
      todo_id: string;
      completed_by_staff_id?: string;
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
    };

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "time");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
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
