import "server-only";

import {
  isSelfOriginatedNotification,
} from "@/lib/notifications/notification-self-origin";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export type StaffTodoNotificationModuleId =
  | "staff_todo_completed"
  | "staff_todo_deferred";

export function isStaffTodoNotificationModule(
  module: NotificationModuleId,
): module is StaffTodoNotificationModuleId {
  return module === "staff_todo_completed" || module === "staff_todo_deferred";
}

function actionsForModule(module: StaffTodoNotificationModuleId): string[] {
  return module === "staff_todo_completed"
    ? ["completed", "completed_by_manager"]
    : ["deferred"];
}

async function fetchDismissedLogIds(
  sb: SupabaseClient,
  params: {
    profileId: string;
    restaurantId: string;
    module: StaffTodoNotificationModuleId;
  },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_staff_todo_notification_dismissals")
    .select("log_entry_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module);

  return new Set(
    (data ?? []).map((row) => (row as { log_entry_id: string }).log_entry_id),
  );
}

export async function loadStaffTodoNotificationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: StaffTodoNotificationModuleId;
    limit?: number;
  },
) {
  const limit = params.limit ?? 5;
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const dismissed = await fetchDismissedLogIds(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    module: params.module,
  });

  const { data, error } = await sb
    .from("restaurant_staff_todo_log_entries")
    .select(
      `
      id,
      action,
      created_at,
      actor_user_id,
      details,
      todo:restaurant_staff_todos ( title )
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .in("action", actionsForModule(params.module))
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 5), 100));

  if (error) {
    console.warn("[gwada] staff todo bell", error.message);
    return { items: [], totalCount: 0 };
  }

  const def = NOTIFICATION_MODULES[params.module];
  const rows = (data ?? []).filter((row) => {
    const r = row as { id: string; actor_user_id: string | null };
    if (dismissed.has(r.id)) return false;
    return !isSelfOriginatedNotification(params.userId, r.actor_user_id);
  });

  const items = rows.slice(0, limit).map((row) => {
    const r = row as {
      id: string;
      created_at: string;
      details: Record<string, unknown> | null;
      todo: { title: string } | { title: string }[] | null;
    };
    const todoRel = Array.isArray(r.todo) ? r.todo[0] : r.todo;
    const title =
      todoRel?.title ??
      (typeof r.details?.title === "string" ? r.details.title : "ToDo");
    const reason =
      typeof r.details?.reason === "string" ? r.details.reason : null;
    const subtitle =
      params.module === "staff_todo_deferred" && reason
        ? `${title} · ${reason}`
        : title;

    return {
      id: r.id,
      title:
        params.module === "staff_todo_completed"
          ? "ToDo erledigt"
          : "ToDo verschoben",
      subtitle,
      href: def.href,
      at: r.created_at,
      meta: { logEntryId: r.id },
    };
  });

  return { items, totalCount: rows.length };
}

export async function dismissStaffTodoNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    logEntryId: string;
    module: StaffTodoNotificationModuleId;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_staff_todo_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        log_entry_id: params.logEntryId,
        module: params.module,
      },
      {
        onConflict: "profile_id,restaurant_id,log_entry_id,module",
      },
    );
  return { error: error?.message ?? null };
}

export async function dismissAllStaffTodoNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: StaffTodoNotificationModuleId;
  },
): Promise<{ error: string | null }> {
  const { items } = await loadStaffTodoNotificationItems(sb, {
    ...params,
    limit: 100,
  });
  for (const item of items) {
    const result = await dismissStaffTodoNotification(sb, {
      ...params,
      logEntryId: item.id,
    });
    if (result.error) return result;
  }
  return { error: null };
}

const STAFF_TODO_PUSH_PERMISSION_KEYS = [
  "staff_todos.read",
  "staff_todos.create",
  "staff_todos.update",
  "staff_todos.delete",
  "staff.manage",
] as const;

export async function filterStaffTodoPushTargets(
  admin: SupabaseClient,
  targets: { profileId: string; restaurantId: string }[],
): Promise<{ profileId: string; restaurantId: string }[]> {
  if (targets.length === 0) return [];

  const restaurantIds = [...new Set(targets.map((t) => t.restaurantId))];
  const allowed = new Set<string>();

  const { data: owners } = await admin
    .from("restaurant_employees")
    .select("profile_id, restaurant_id, restaurant_positions!inner(slug)")
    .in("restaurant_id", restaurantIds)
    .eq("is_active", true)
    .eq("restaurant_positions.slug", "owner");

  for (const row of owners ?? []) {
    const r = row as { profile_id: string; restaurant_id: string };
    allowed.add(`${r.profile_id}:${r.restaurant_id}`);
  }

  const { data: permitted } = await admin
    .from("restaurant_employees")
    .select(
      "profile_id, restaurant_id, restaurant_position_permissions!inner(permission_key)",
    )
    .in("restaurant_id", restaurantIds)
    .eq("is_active", true)
    .in(
      "restaurant_position_permissions.permission_key",
      [...STAFF_TODO_PUSH_PERMISSION_KEYS],
    );

  for (const row of permitted ?? []) {
    const r = row as { profile_id: string; restaurant_id: string };
    allowed.add(`${r.profile_id}:${r.restaurant_id}`);
  }

  return targets.filter((t) =>
    allowed.has(`${t.profileId}:${t.restaurantId}`),
  );
}
