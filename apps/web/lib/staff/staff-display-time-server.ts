import "server-only";

import { randomUUID } from "crypto";
import { signStaffAvatarUrl } from "@/lib/display/display-storage-urls";
import { emitStaffDisplayClockNotification } from "@/lib/notifications/notification-staff-display-clock-server";
import {
  isDisplayAutoClockOutDue,
  type StaffDisplayAutoClockOutPolicy,
} from "@/lib/staff/staff-display-auto-clock-out";
import { fetchStaffModuleSettingsServer } from "@/lib/staff/staff-module-settings-server";
import type {
  DisplayTeamPresenceMember,
  StaffPresenceStatus,
} from "@/lib/types/staff";
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

export type { DisplayTeamPresenceMember } from "@/lib/types/staff";

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

async function loadDisplayAutoClockOutPolicy(
  restaurantId: string,
): Promise<StaffDisplayAutoClockOutPolicy> {
  const { displayAutoClockOut } =
    await fetchStaffModuleSettingsServer(restaurantId);
  return displayAutoClockOut;
}

async function closeOpenEntryWithAutoClockOutNotify(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    entryId: string;
    shiftId: string;
    at: string;
  },
): Promise<void> {
  await closeOpenEntry(admin, params.entryId, params.at);
  await emitStaffDisplayClockNotification(admin, {
    restaurantId: params.restaurantId,
    staffId: params.staffId,
    shiftId: params.shiftId,
    action: "clock_out",
    at: params.at,
    auto: true,
  });
}

async function silentCloseAutoClockOutEntry(
  admin: SupabaseClient,
  params: {
    staffId: string;
    restaurantId: string;
    policy?: StaffDisplayAutoClockOutPolicy;
  },
): Promise<boolean> {
  const policy =
    params.policy ?? (await loadDisplayAutoClockOutPolicy(params.restaurantId));
  const open = await findOpenDisplayEntry(admin, params.staffId);
  if (!open || !isDisplayAutoClockOutDue(open, policy)) return false;
  const at = new Date().toISOString();
  await closeOpenEntryWithAutoClockOutNotify(admin, {
    restaurantId: params.restaurantId,
    staffId: params.staffId,
    entryId: open.id,
    shiftId: open.shift_id,
    at,
  });
  return true;
}

export async function getStaffDisplayTimeState(
  admin: SupabaseClient,
  staffId: string,
  restaurantId?: string,
): Promise<StaffDisplayTimeState> {
  if (restaurantId) {
    await silentCloseAutoClockOutEntry(admin, {
      staffId,
      restaurantId,
    });
  }

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
  const policy = await loadDisplayAutoClockOutPolicy(restaurantId);
  const nowDate = new Date();
  const nowIso = nowDate.toISOString();

  const { data: openEntries } = await admin
    .from("restaurant_staff_work_entries")
    .select("id, staff_id, shift_id, entry_type, starts_at")
    .eq("restaurant_id", restaurantId)
    .eq("is_open", true)
    .not("shift_id", "is", null);

  const out: StaffLivePresenceRow[] = [];
  for (const row of openEntries ?? []) {
    const entryId = row.id as string;
    const shiftId = row.shift_id as string;
    const staffId = row.staff_id as string;
    const entryType = row.entry_type as "work" | "break";
    const startsAt = row.starts_at as string;
    if (isDisplayAutoClockOutDue({ starts_at: startsAt }, policy, nowDate)) {
      await closeOpenEntryWithAutoClockOutNotify(admin, {
        restaurantId,
        staffId,
        entryId,
        shiftId,
        at: nowIso,
      });
      continue;
    }
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

export async function listDisplayTeamPresence(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<DisplayTeamPresenceMember[]> {
  const presence = await listStaffLivePresence(admin, restaurantId);
  if (presence.length === 0) return [];

  const staffIds = presence.map((p) => p.staff_id);
  const { data: staffRows } = await admin
    .from("restaurant_staff")
    .select(
      `
      id,
      given_name,
      family_name,
      avatar_storage_path,
      restaurant_position:restaurant_positions ( name )
    `,
    )
    .eq("restaurant_id", restaurantId)
    .in("id", staffIds);

  const staffById = new Map<
    string,
    {
      given_name: string;
      family_name: string;
      avatar_url: string | null;
      position_name: string | null;
    }
  >();

  await Promise.all(
    (staffRows ?? []).map(async (row) => {
      const posRaw = (row as Record<string, unknown>).restaurant_position;
      const posOne = Array.isArray(posRaw) ? posRaw[0] : posRaw;
      const positionName =
        posOne && typeof posOne === "object" && "name" in posOne
          ? String((posOne as { name: string }).name)
          : null;
      staffById.set(row.id as string, {
        given_name: row.given_name as string,
        family_name: row.family_name as string,
        avatar_url: await signStaffAvatarUrl(
          admin,
          row.avatar_storage_path as string | null,
        ),
        position_name: positionName,
      });
    }),
  );

  const members = presence
    .map((p) => {
      const staff = staffById.get(p.staff_id);
      if (!staff) return null;
      return {
        staff_id: p.staff_id,
        ...staff,
        status: p.status,
        clocked_in_at: p.clocked_in_at,
        break_started_at: p.break_started_at,
      };
    })
    .filter((row): row is DisplayTeamPresenceMember => row != null);

  // Frühester Schichtbeginn zuerst; Pause-Status bleibt in der UI markiert.
  members.sort((a, b) => {
    const byStart = a.clocked_in_at.localeCompare(b.clocked_in_at);
    if (byStart !== 0) return byStart;
    const nameA = `${a.family_name} ${a.given_name}`.trim();
    const nameB = `${b.family_name} ${b.given_name}`.trim();
    return nameA.localeCompare(nameB, "de");
  });

  return members;
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.from("restaurant_staff_work_entries").insert({
    restaurant_id: params.restaurantId,
    staff_id: params.staffId,
    entry_type: params.entryType,
    starts_at: params.startsAt,
    ends_at: params.startsAt,
    is_open: true,
    shift_id: params.shiftId,
    note: DISPLAY_NOTE,
  });
  if (error) {
    return { ok: false, error: error.message || "work_entry_insert_failed" };
  }
  return { ok: true };
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
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const autoClockOut = await loadDisplayAutoClockOutPolicy(params.restaurantId);
  let open = await findOpenDisplayEntry(admin, params.staffId);

  if (params.action === "clock_in") {
    if (open && isDisplayAutoClockOutDue(open, autoClockOut, nowDate)) {
      await closeOpenEntryWithAutoClockOutNotify(admin, {
        restaurantId: params.restaurantId,
        staffId: params.staffId,
        entryId: open.id,
        shiftId: open.shift_id,
        at: now,
      });
      open = null;
    }
    if (open) {
      return { ok: false, error: "already_clocked_in", status: 409 };
    }
    const shiftId = randomUUID();
    const opened = await openSegment(admin, {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      shiftId,
      entryType: "work",
      startsAt: now,
    });
    if (!opened.ok) {
      return { ok: false, error: opened.error, status: 500 };
    }
    await emitStaffDisplayClockNotification(admin, {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      shiftId,
      action: "clock_in",
      at: now,
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
    const opened = await openSegment(admin, {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      shiftId: open.shift_id,
      entryType: "break",
      startsAt: now,
    });
    if (!opened.ok) {
      return { ok: false, error: opened.error, status: 500 };
    }
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
    if (isDisplayAutoClockOutDue(open, autoClockOut, nowDate)) {
      await closeOpenEntryWithAutoClockOutNotify(admin, {
        restaurantId: params.restaurantId,
        staffId: params.staffId,
        entryId: open.id,
        shiftId: open.shift_id,
        at: now,
      });
      return {
        ok: true,
        state: { status: "off", clocked_in_at: null, break_started_at: null },
      };
    }
    await closeOpenEntry(admin, open.id, now);
    const opened = await openSegment(admin, {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      shiftId: open.shift_id,
      entryType: "work",
      startsAt: now,
    });
    if (!opened.ok) {
      return { ok: false, error: opened.error, status: 500 };
    }
    const clockedInAt = await shiftClockedInAt(admin, open.shift_id, open.starts_at);
    return {
      ok: true,
      state: { status: "working", clocked_in_at: clockedInAt, break_started_at: null },
    };
  }

  if (params.action === "clock_out") {
    const isAuto = isDisplayAutoClockOutDue(open, autoClockOut, nowDate);
    // Pause am gleichen Tag beenden: kein Push. Auto-Abmeldung: Push mit Hinweis.
    const skipNotify = open.entry_type === "break" && !isAuto;
    await closeOpenEntry(admin, open.id, now);
    if (!skipNotify) {
      await emitStaffDisplayClockNotification(admin, {
        restaurantId: params.restaurantId,
        staffId: params.staffId,
        shiftId: open.shift_id,
        action: "clock_out",
        at: now,
        ...(isAuto ? { auto: true } : {}),
      });
    }
    return {
      ok: true,
      state: { status: "off", clocked_in_at: null, break_started_at: null },
    };
  }

  return { ok: false, error: "invalid_action", status: 400 };
}
