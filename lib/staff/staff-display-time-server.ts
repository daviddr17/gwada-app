import "server-only";

import { randomUUID } from "crypto";
import type { StaffPresenceStatus } from "@/lib/types/staff";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffDisplayTimeState = {
  status: StaffPresenceStatus;
  clocked_in_at: string | null;
  break_started_at: string | null;
};

export type StaffLivePresenceRow = {
  staff_id: string;
  status: Exclude<StaffPresenceStatus, "off">;
  clocked_in_at: string;
  break_started_at: string | null;
};

type DisplayTimeAction = "clock_in" | "start_break" | "end_break" | "clock_out";

const DISPLAY_NOTE = "Display";

async function findOpenDisplayEntry(
  admin: SupabaseClient,
  staffId: string,
): Promise<{
  id: string;
  shift_id: string;
  entry_type: "work" | "break";
  starts_at: string;
} | null> {
  const { data } = await admin
    .from("restaurant_staff_work_entries")
    .select("id, shift_id, entry_type, starts_at")
    .eq("staff_id", staffId)
    .eq("is_open", true)
    .not("shift_id", "is", null)
    .maybeSingle();

  if (!data?.shift_id) return null;
  return {
    id: data.id as string,
    shift_id: data.shift_id as string,
    entry_type: data.entry_type as "work" | "break",
    starts_at: data.starts_at as string,
  };
}

async function shiftClockedInAt(
  admin: SupabaseClient,
  shiftId: string,
  fallback: string,
): Promise<string> {
  const { data } = await admin
    .from("restaurant_staff_work_entries")
    .select("starts_at")
    .eq("shift_id", shiftId)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.starts_at as string | undefined) ?? fallback;
}

export async function getStaffDisplayTimeState(
  admin: SupabaseClient,
  staffId: string,
): Promise<StaffDisplayTimeState> {
  const open = await findOpenDisplayEntry(admin, staffId);
  if (!open) {
    return { status: "off", clocked_in_at: null, break_started_at: null };
  }

  const clockedInAt = await shiftClockedInAt(admin, open.shift_id, open.starts_at);
  if (open.entry_type === "break") {
    return {
      status: "on_break",
      clocked_in_at: clockedInAt,
      break_started_at: open.starts_at,
    };
  }

  return {
    status: "working",
    clocked_in_at: clockedInAt,
    break_started_at: null,
  };
}

export async function listStaffLivePresence(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<StaffLivePresenceRow[]> {
  const { data: openEntries } = await admin
    .from("restaurant_staff_work_entries")
    .select("staff_id, shift_id, entry_type, starts_at")
    .eq("restaurant_id", restaurantId)
    .eq("is_open", true)
    .not("shift_id", "is", null);

  const out: StaffLivePresenceRow[] = [];
  for (const row of openEntries ?? []) {
    const shiftId = row.shift_id as string;
    const staffId = row.staff_id as string;
    const entryType = row.entry_type as "work" | "break";
    const startsAt = row.starts_at as string;
    const clockedInAt = await shiftClockedInAt(admin, shiftId, startsAt);
    out.push({
      staff_id: staffId,
      status: entryType === "break" ? "on_break" : "working",
      clocked_in_at: clockedInAt,
      break_started_at: entryType === "break" ? startsAt : null,
    });
  }
  return out;
}

async function closeOpenEntry(
  admin: SupabaseClient,
  entryId: string,
  endsAt: string,
): Promise<void> {
  await admin
    .from("restaurant_staff_work_entries")
    .update({ ends_at: endsAt, is_open: false })
    .eq("id", entryId);
}

async function openSegment(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    shiftId: string;
    entryType: "work" | "break";
    startsAt: string;
  },
): Promise<void> {
  await admin.from("restaurant_staff_work_entries").insert({
    restaurant_id: params.restaurantId,
    staff_id: params.staffId,
    entry_type: params.entryType,
    starts_at: params.startsAt,
    ends_at: params.startsAt,
    is_open: true,
    shift_id: params.shiftId,
    note: DISPLAY_NOTE,
  });
}

export async function runDisplayTimeAction(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    action: DisplayTimeAction;
  },
): Promise<
  | { ok: true; state: StaffDisplayTimeState }
  | { ok: false; error: string; status: number }
> {
  const now = new Date().toISOString();
  const open = await findOpenDisplayEntry(admin, params.staffId);

  if (params.action === "clock_in") {
    if (open) {
      return { ok: false, error: "already_clocked_in", status: 409 };
    }
    const shiftId = randomUUID();
    await openSegment(admin, {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      shiftId,
      entryType: "work",
      startsAt: now,
    });
    return {
      ok: true,
      state: { status: "working", clocked_in_at: now, break_started_at: null },
    };
  }

  if (!open) {
    return { ok: false, error: "not_clocked_in", status: 409 };
  }

  if (params.action === "start_break") {
    if (open.entry_type === "break") {
      return { ok: false, error: "already_on_break", status: 409 };
    }
    await closeOpenEntry(admin, open.id, now);
    await openSegment(admin, {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      shiftId: open.shift_id,
      entryType: "break",
      startsAt: now,
    });
    const clockedInAt = await shiftClockedInAt(admin, open.shift_id, open.starts_at);
    return {
      ok: true,
      state: {
        status: "on_break",
        clocked_in_at: clockedInAt,
        break_started_at: now,
      },
    };
  }

  if (params.action === "end_break") {
    if (open.entry_type !== "break") {
      return { ok: false, error: "not_on_break", status: 409 };
    }
    await closeOpenEntry(admin, open.id, now);
    await openSegment(admin, {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      shiftId: open.shift_id,
      entryType: "work",
      startsAt: now,
    });
    const clockedInAt = await shiftClockedInAt(admin, open.shift_id, open.starts_at);
    return {
      ok: true,
      state: { status: "working", clocked_in_at: clockedInAt, break_started_at: null },
    };
  }

  if (params.action === "clock_out") {
    await closeOpenEntry(admin, open.id, now);
    return {
      ok: true,
      state: { status: "off", clocked_in_at: null, break_started_at: null },
    };
  }

  return { ok: false, error: "invalid_action", status: 400 };
}
