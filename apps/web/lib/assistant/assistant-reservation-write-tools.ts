import "server-only";

import { assistantAsk, assistantAskWhich } from "@/lib/assistant/assistant-ask";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import {
  assistantJson,
  denyUnlessModuleCrud,
  draftMutation,
} from "@/lib/assistant/assistant-tool-auth";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { reservationRangeIso } from "@/lib/assistant/assistant-tools";
import { resolveRestaurantEmployeeId } from "@/lib/documents/document-log-server";
import { parseReservationPendingChange } from "@/lib/reservations/reservation-pending-change";
import { relocatedFromPatchOnDatetimeChange } from "@/lib/reservations/reservation-relocated-marker";
import { insertReservationLogEntry } from "@/lib/reservations/reservation-log-insert";
import { buildReservationLogDetails } from "@/lib/reservations/reservation-log-build";
import {
  restaurantIsoToYmdHm,
  restaurantTodayYmd,
  ymdHmToRestaurantIso,
} from "@/lib/restaurant/restaurant-timezone";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import { formatDiningTableLabel } from "@/lib/supabase/dining-floor-db";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { RESERVATION_DAY_NOTE_MAX_LENGTH } from "@/lib/types/reservation-day-notes";
import { formatReservationGuestLabel } from "@/lib/types/reservation-log";
import type { AppLocale } from "@/i18n/config";
import type { SupabaseClient } from "@supabase/supabase-js";

type FoundReservation = {
  id: string;
  label: string;
  status_id: string | null;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  dwell_minutes: number | null;
  dining_table_id: string | null;
  notes: string | null;
};

async function findReservationByGuest(
  ctx: AssistantToolContext,
  restaurantId: string,
  guestName: string,
  dateYmd: string | null,
  locale: AppLocale,
): Promise<
  { ok: true; row: FoundReservation } | { ok: false; ask?: string; error?: string }
> {
  const today = restaurantTodayYmd(
    await fetchRestaurantTimezoneServer(ctx.sb, restaurantId),
  );
  const day = dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd) ? dateYmd : today;
  const bounds = await reservationRangeIso(ctx.sb, restaurantId, day, day);
  if ("error" in bounds) {
    return { ok: false, ask: assistantAsk(locale, "whichDate") };
  }
  const q = guestName.replace(/[%_,]/g, "").trim();
  if (!q) return { ok: false, ask: assistantAsk(locale, "guest") };

  const { data, error } = await ctx.sb
    .from("reservations")
    .select(
      "id, guest_first_name, guest_last_name, guest_phone, party_size, starts_at, ends_at, dwell_minutes, dining_table_id, notes, status_id",
    )
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", bounds.startIso)
    .lt("starts_at", bounds.endIso)
    .or(`guest_first_name.ilike.%${q}%,guest_last_name.ilike.%${q}%`)
    .limit(6);
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) return { ok: false, ask: assistantAsk(locale, "guest") };
  if (rows.length > 1) {
    return {
      ok: false,
      ask: assistantAskWhich(
        locale,
        "which",
        rows.map((row) =>
          `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim(),
        ),
      ),
    };
  }
  const row = rows[0]!;
  return {
    ok: true,
    row: {
      id: row.id as string,
      label: `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim(),
      status_id: (row.status_id as string | null) ?? null,
      guest_first_name: String(row.guest_first_name ?? ""),
      guest_last_name: String(row.guest_last_name ?? ""),
      guest_phone: (row.guest_phone as string | null) ?? null,
      party_size: Number(row.party_size) || 0,
      starts_at: String(row.starts_at),
      ends_at: String(row.ends_at),
      dwell_minutes:
        typeof row.dwell_minutes === "number" ? row.dwell_minutes : null,
      dining_table_id: (row.dining_table_id as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    },
  };
}

async function loadReservationById(
  sb: SupabaseClient,
  restaurantId: string,
  id: string,
): Promise<{ ok: true; row: FoundReservation } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("reservations")
    .select(
      "id, guest_first_name, guest_last_name, guest_phone, party_size, starts_at, ends_at, dwell_minutes, dining_table_id, notes, status_id",
    )
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Reservierung nicht gefunden." };
  return {
    ok: true,
    row: {
      id: data.id as string,
      label: `${data.guest_first_name ?? ""} ${data.guest_last_name ?? ""}`.trim(),
      status_id: (data.status_id as string | null) ?? null,
      guest_first_name: String(data.guest_first_name ?? ""),
      guest_last_name: String(data.guest_last_name ?? ""),
      guest_phone: (data.guest_phone as string | null) ?? null,
      party_size: Number(data.party_size) || 0,
      starts_at: String(data.starts_at),
      ends_at: String(data.ends_at),
      dwell_minutes:
        typeof data.dwell_minutes === "number" ? data.dwell_minutes : null,
      dining_table_id: (data.dining_table_id as string | null) ?? null,
      notes: (data.notes as string | null) ?? null,
    },
  };
}

function hasEditFields(args: Record<string, unknown>): boolean {
  return (
    args.time_hm != null ||
    args.new_date_ymd != null ||
    args.party_size != null ||
    args.notes != null ||
    args.table != null ||
    args.table_label != null ||
    args.dining_table != null ||
    args.clear_table === true ||
    args.guest_first_name != null ||
    args.guest_last_name != null ||
    args.guest_phone != null
  );
}

async function resolveDiningTableId(
  sb: SupabaseClient,
  restaurantId: string,
  tableRaw: string,
  locale: AppLocale,
): Promise<
  | { ok: true; id: string; label: string }
  | { ok: false; ask?: string; error?: string }
> {
  const q = tableRaw.replace(/[%_,]/g, "").trim();
  if (!q) {
    return {
      ok: false,
      ask:
        locale === "de"
          ? "Welchen Tisch meinst du?"
          : "Which table do you mean?",
    };
  }

  const { data, error } = await sb
    .from("dining_tables")
    .select("id, table_number, table_name, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .limit(80);
  if (error) return { ok: false, error: error.message };

  const needle = q.toLowerCase().replace(/^tisch\s+/i, "").trim();
  const matches = (data ?? []).filter((t) => {
    const name = String(t.table_name ?? "").toLowerCase();
    const num = String(t.table_number ?? "");
    const label = formatDiningTableLabel({
      table_name: t.table_name as string | null,
      table_number: Number(t.table_number),
    }).toLowerCase();
    return (
      name === needle ||
      num === needle ||
      label === needle ||
      name.includes(needle) ||
      label.includes(needle)
    );
  });

  if (matches.length === 0) {
    return {
      ok: false,
      ask:
        locale === "de"
          ? `Welchen Tisch meinst du mit „${tableRaw}“?`
          : `Which table is “${tableRaw}”?`,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      ask: assistantAskWhich(
        locale,
        "which",
        matches.map((t) =>
          formatDiningTableLabel({
            table_name: t.table_name as string | null,
            table_number: Number(t.table_number),
          }),
        ),
      ),
    };
  }
  const t = matches[0]!;
  return {
    ok: true,
    id: t.id as string,
    label: formatDiningTableLabel({
      table_name: t.table_name as string | null,
      table_number: Number(t.table_number),
    }),
  };
}

function editSummaryLines(
  changes: string[],
  label: string,
  locale: AppLocale,
): string {
  if (locale === "de") {
    return `Reservierung ${label} ändern: ${changes.join(", ")}`;
  }
  return `Edit reservation ${label}: ${changes.join(", ")}`;
}

async function toolEditReservation(
  target: {
    restaurantId: string;
    restaurantName: string | null;
    sb: AssistantToolContext["sb"];
  },
  args: Record<string, unknown>,
  locale: AppLocale,
  found: FoundReservation,
): Promise<string> {
  const timeZone = await fetchRestaurantTimezoneServer(
    target.sb,
    target.restaurantId,
  );
  const current = restaurantIsoToYmdHm(found.starts_at, timeZone);
  const patch: Record<string, unknown> = {};
  const changes: string[] = [];

  const newDate =
    typeof args.new_date_ymd === "string" ? args.new_date_ymd.trim() : "";
  const newTime = typeof args.time_hm === "string" ? args.time_hm.trim() : "";
  if (newDate || newTime) {
    const ymd = newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate) ? newDate : current.ymd;
    const hm = newTime && /^\d{1,2}:\d{2}$/.test(newTime) ? newTime : current.hm;
    if (newDate && !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return assistantJson({ ok: false, ask: assistantAsk(locale, "whichDate") });
    }
    if (newTime && !/^\d{1,2}:\d{2}$/.test(newTime)) {
      return assistantJson({
        ok: false,
        ask:
          locale === "de"
            ? "Welche Uhrzeit? (z. B. 19:00)"
            : "What time? (e.g. 19:00)",
      });
    }
    let startsIso: string;
    try {
      startsIso = ymdHmToRestaurantIso(ymd, hm, timeZone);
    } catch {
      return assistantJson({
        ok: false,
        error: "Ungültiges Datum oder Uhrzeit.",
      });
    }
    const dwell =
      found.dwell_minutes ??
      Math.max(
        30,
        Math.round(
          (new Date(found.ends_at).getTime() -
            new Date(found.starts_at).getTime()) /
            60000,
        ),
      );
    const endsIso = new Date(
      new Date(startsIso).getTime() + dwell * 60_000,
    ).toISOString();
    if (startsIso !== found.starts_at) {
      patch.starts_at = startsIso;
      patch.ends_at = endsIso;
      patch.dwell_minutes = dwell;
      const relocate = relocatedFromPatchOnDatetimeChange({
        beforeStartsAt: found.starts_at,
        beforeEndsAt: found.ends_at,
        afterStartsAt: startsIso,
        afterEndsAt: endsIso,
        beforeDiningTableId: found.dining_table_id,
      });
      if (relocate) Object.assign(patch, relocate);
      changes.push(
        locale === "de"
          ? `Termin ${ymd} ${hm}`
          : `slot ${ymd} ${hm}`,
      );
    }
  }

  if (args.party_size != null) {
    const party = Number(args.party_size);
    if (!Number.isFinite(party) || party < 1 || party > 200) {
      return assistantJson({
        ok: false,
        ask:
          locale === "de"
            ? "Für wie viele Personen?"
            : "For how many guests?",
      });
    }
    if (party !== found.party_size) {
      patch.party_size = party;
      changes.push(
        locale === "de" ? `${party} Personen` : `${party} guests`,
      );
    }
  }

  if (args.notes != null) {
    const notes = String(args.notes).trim() || null;
    if (notes !== (found.notes?.trim() || null)) {
      patch.notes = notes;
      changes.push(locale === "de" ? "Notiz" : "notes");
    }
  }

  if (args.clear_table === true) {
    if (found.dining_table_id) {
      patch.dining_table_id = null;
      changes.push(locale === "de" ? "Tisch entfernen" : "clear table");
    }
  } else {
    const tableRaw = String(
      args.table ?? args.table_label ?? args.dining_table ?? "",
    ).trim();
    if (tableRaw) {
      const table = await resolveDiningTableId(
        target.sb,
        target.restaurantId,
        tableRaw,
        locale,
      );
      if (!table.ok) {
        return assistantJson({ ok: false, ask: table.ask, error: table.error });
      }
      if (table.id !== found.dining_table_id) {
        patch.dining_table_id = table.id;
        changes.push(
          locale === "de" ? `Tisch ${table.label}` : `table ${table.label}`,
        );
      }
    }
  }

  if (args.guest_first_name != null) {
    const first = normalizeReservationGuestFirstName(
      String(args.guest_first_name),
    );
    if (!first) {
      return assistantJson({ ok: false, ask: assistantAsk(locale, "guest") });
    }
    if (first !== found.guest_first_name) {
      patch.guest_first_name = first;
      changes.push(locale === "de" ? `Vorname ${first}` : `first name ${first}`);
    }
  }
  if (args.guest_last_name != null) {
    const last = normalizeReservationGuestLastName(String(args.guest_last_name));
    if (last !== found.guest_last_name) {
      patch.guest_last_name = last;
      changes.push(locale === "de" ? `Nachname ${last || "—"}` : `last name ${last || "—"}`);
    }
  }
  if (args.guest_phone != null) {
    const phone = String(args.guest_phone).trim() || null;
    if (phone !== (found.guest_phone?.trim() || null)) {
      patch.guest_phone = phone;
      changes.push(locale === "de" ? "Telefon" : "phone");
    }
  }

  if (Object.keys(patch).length === 0 || changes.length === 0) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Was soll an der Reservierung geändert werden (Uhrzeit, Personen, Tisch, Notiz, Name)?"
          : "What should change (time, party size, table, notes, name)?",
    });
  }

  const nextLabel =
    typeof patch.guest_first_name === "string" ||
    typeof patch.guest_last_name === "string"
      ? `${String(patch.guest_first_name ?? found.guest_first_name)} ${String(patch.guest_last_name ?? found.guest_last_name)}`.trim()
      : found.label;

  const preview = {
    mutation: "edit",
    reservation_id: found.id,
    guest_name: nextLabel,
    date_ymd: typeof args.date_ymd === "string" ? args.date_ymd : current.ymd,
    patch,
    changes,
  };

  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "update_reservation",
      message: editSummaryLines(changes, nextLabel, locale),
      preview,
    });
  }

  const { error } = await target.sb
    .from("reservations")
    .update(patch)
    .eq("id", found.id)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });

  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Reservierung ${nextLabel} aktualisiert (${changes.join(", ")}).`
        : `Reservation ${nextLabel} updated (${changes.join(", ")}).`,
  });
}

export async function toolUpdateReservation(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }

  const action = String(args.action ?? "").toLowerCase();
  const isCancel = action === "cancel" || action === "stornieren";
  const wantsEdit =
    action === "edit" ||
    action === "update" ||
    action === "ändern" ||
    (hasEditFields(args) &&
      action !== "set_status" &&
      action !== "status" &&
      !isCancel);

  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "reservations",
    "update",
    isCancel
      ? "Keine Berechtigung, Reservierungen zu stornieren."
      : "Keine Berechtigung, Reservierungen zu ändern.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const guestName = String(args.guest_name ?? "").trim();
  const reservationId =
    typeof args.reservation_id === "string" ? args.reservation_id.trim() : "";

  let found: FoundReservation | null = null;
  if (reservationId) {
    const loaded = await loadReservationById(
      target.sb,
      target.restaurantId,
      reservationId,
    );
    if (!loaded.ok) return assistantJson({ ok: false, error: loaded.error });
    found = loaded.row;
  } else {
    const lookup = await findReservationByGuest(
      ctx,
      target.restaurantId,
      guestName,
      typeof args.date_ymd === "string" ? args.date_ymd : null,
      locale,
    );
    if (!lookup.ok) {
      return assistantJson({
        ok: false,
        ask: lookup.ask,
        error: lookup.error,
      });
    }
    found = lookup.row;
  }

  if (wantsEdit) {
    return toolEditReservation(target, args, locale, found);
  }

  if (isCancel) {
    const { data: statuses, error: stErr } = await target.sb
      .from("reservation_statuses")
      .select("id, code, name")
      .eq("code", "cancelled")
      .maybeSingle();
    if (stErr) return assistantJson({ ok: false, error: stErr.message });
    if (!statuses?.id) {
      return assistantJson({
        ok: false,
        error: "Status „cancelled“ nicht gefunden.",
      });
    }
    const preview = {
      reservation_id: found.id,
      guest_name: found.label,
      status_code: "cancelled",
      status_id: statuses.id,
      status_name: statuses.name,
      date_ymd: typeof args.date_ymd === "string" ? args.date_ymd : null,
      mutation: "cancel",
    };
    if (!args.confirm) {
      return draftMutation({
        locale,
        action: "update_reservation",
        message:
          locale === "de"
            ? `Reservierung ${found.label} stornieren?`
            : `Cancel reservation ${found.label}?`,
        preview,
      });
    }
    const { error } = await target.sb
      .from("reservations")
      .update({ status_id: statuses.id })
      .eq("id", found.id)
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
    return assistantJson({
      ok: true,
      status: "saved",
      message:
        locale === "de"
          ? `Reservierung ${found.label} storniert.`
          : `Reservation ${found.label} cancelled.`,
    });
  }

  const statusCode = String(args.status_code ?? args.status ?? "")
    .trim()
    .toLowerCase();
  if (!statusCode) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Was soll geändert werden — Status, Storno, oder Felder (Uhrzeit/Personen/Tisch/Notiz)?"
          : "What should change — status, cancel, or fields (time/party/table/notes)?",
    });
  }
  const { data: status, error: stErr } = await target.sb
    .from("reservation_statuses")
    .select("id, code, name")
    .eq("code", statusCode)
    .maybeSingle();
  if (stErr) return assistantJson({ ok: false, error: stErr.message });
  if (!status?.id) {
    return assistantJson({
      ok: false,
      error: `Unbekannter Status: ${statusCode}`,
    });
  }
  const preview = {
    reservation_id: found.id,
    guest_name: found.label,
    status_code: status.code,
    status_id: status.id,
    status_name: status.name,
    mutation: "set_status",
    date_ymd: typeof args.date_ymd === "string" ? args.date_ymd : null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "update_reservation",
      message:
        locale === "de"
          ? `Reservierung ${found.label} → ${status.name}?`
          : `Set reservation ${found.label} to ${status.name}?`,
      preview,
    });
  }
  const { error } = await target.sb
    .from("reservations")
    .update({ status_id: status.id })
    .eq("id", found.id)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Reservierung ${found.label}: ${status.name}.`
        : `Reservation ${found.label}: ${status.name}.`,
  });
}

export async function applyUpdateReservationPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const mutation = String(preview.mutation ?? "set_status");
  if (mutation === "edit") {
    return applyEditReservationPreview(ctx, preview, locale);
  }
  return toolUpdateReservation(
    ctx,
    {
      reservation_id: preview.reservation_id,
      guest_name: preview.guest_name,
      status_code: preview.status_code,
      action: mutation === "cancel" ? "cancel" : "set_status",
      date_ymd: preview.date_ymd,
      confirm: true,
    },
    locale,
  );
}

/** Confirm path: apply the exact draft patch (no re-derive from natural-language args). */
async function applyEditReservationPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(
    ctx,
    { restaurant_name: preview.restaurant_name },
    locale,
    "write",
  );
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "reservations",
    "update",
    "Keine Berechtigung, Reservierungen zu ändern.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const reservationId = String(preview.reservation_id ?? "").trim();
  const patch =
    preview.patch && typeof preview.patch === "object"
      ? (preview.patch as Record<string, unknown>)
      : null;
  if (!reservationId || !patch || Object.keys(patch).length === 0) {
    return assistantJson({ ok: false, error: "Ungültige Edit-Vorschau." });
  }

  const { error } = await target.sb
    .from("reservations")
    .update(patch)
    .eq("id", reservationId)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });

  const label = String(preview.guest_name ?? "").trim() || reservationId;
  const changes = Array.isArray(preview.changes)
    ? preview.changes.map(String)
    : [];
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Reservierung ${label} aktualisiert${changes.length ? ` (${changes.join(", ")})` : ""}.`
        : `Reservation ${label} updated${changes.length ? ` (${changes.join(", ")})` : ""}.`,
  });
}

export async function toolDeleteReservation(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "reservations",
    "delete",
    "Keine Berechtigung, Reservierungen zu löschen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const guestName = String(args.guest_name ?? "").trim();
  const reservationId =
    typeof args.reservation_id === "string" ? args.reservation_id.trim() : "";
  let found: FoundReservation;
  if (reservationId) {
    const loaded = await loadReservationById(
      target.sb,
      target.restaurantId,
      reservationId,
    );
    if (!loaded.ok) return assistantJson({ ok: false, error: loaded.error });
    found = loaded.row;
  } else {
    const lookup = await findReservationByGuest(
      ctx,
      target.restaurantId,
      guestName,
      typeof args.date_ymd === "string" ? args.date_ymd : null,
      locale,
    );
    if (!lookup.ok) {
      return assistantJson({ ok: false, ask: lookup.ask, error: lookup.error });
    }
    found = lookup.row;
  }

  const preview = {
    reservation_id: found.id,
    guest_name: found.label,
    date_ymd: typeof args.date_ymd === "string" ? args.date_ymd : null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "delete_reservation",
      message:
        locale === "de"
          ? `Reservierung ${found.label} endgültig löschen`
          : `Permanently delete reservation ${found.label}`,
      preview,
    });
  }
  const { error } = await target.sb
    .from("reservations")
    .delete()
    .eq("id", found.id)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Reservierung ${found.label} gelöscht.`
        : `Reservation ${found.label} deleted.`,
  });
}

export async function applyDeleteReservationPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolDeleteReservation(
    ctx,
    {
      reservation_id: preview.reservation_id,
      guest_name: preview.guest_name,
      date_ymd: preview.date_ymd,
      confirm: true,
    },
    locale,
  );
}

export async function toolSetReservationDayNote(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  // Same gate as day-note API: reservations.read (or manage) for mutate own notes;
  // creating a note is allowed with read (like the route POST).
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "reservations",
    "read",
    "Keine Berechtigung für Tagesnotizen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const timeZone = await fetchRestaurantTimezoneServer(
    target.sb,
    target.restaurantId,
  );
  const today = restaurantTodayYmd(timeZone);
  const dateYmd =
    typeof args.date_ymd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date_ymd.trim())
      ? args.date_ymd.trim()
      : today;
  const body = String(args.body ?? args.note ?? args.text ?? "").trim();
  if (!body) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Was soll in der Tagesnotiz stehen?"
          : "What should the day note say?",
    });
  }
  if (body.length > RESERVATION_DAY_NOTE_MAX_LENGTH) {
    return assistantJson({
      ok: false,
      error: "Tagesnotiz ist zu lang.",
    });
  }

  const preview = {
    date_ymd: dateYmd,
    body,
    restaurant_name: target.restaurantName,
  };
  if (!args.confirm) {
    const short = body.length > 80 ? `${body.slice(0, 77)}…` : body;
    return draftMutation({
      locale,
      action: "set_reservation_day_note",
      message:
        locale === "de"
          ? `Tagesnotiz ${dateYmd}: „${short}“`
          : `Day note ${dateYmd}: “${short}”`,
      preview,
    });
  }

  const employeeId = await resolveRestaurantEmployeeId(
    target.sb,
    target.restaurantId,
    ctx.userId,
  );
  const { error } = await target.sb
    .from("restaurant_reservation_day_note_entries")
    .insert({
      restaurant_id: target.restaurantId,
      service_date: dateYmd,
      employee_id: employeeId,
      actor_user_id: ctx.userId,
      body,
    });
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Tagesnotiz für ${dateYmd} gespeichert.`
        : `Day note for ${dateYmd} saved.`,
  });
}

export async function applySetReservationDayNotePreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolSetReservationDayNote(
    ctx,
    {
      date_ymd: preview.date_ymd,
      body: preview.body,
      confirm: true,
    },
    locale,
  );
}

export async function toolResolveReservationChangeRequest(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "reservations",
    "update",
    "Keine Berechtigung, Änderungsanfragen zu bearbeiten.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const decisionRaw = String(args.decision ?? args.action ?? "")
    .trim()
    .toLowerCase();
  const approve =
    decisionRaw === "approve" ||
    decisionRaw === "accept" ||
    decisionRaw === "genehmigen" ||
    decisionRaw === "annehmen";
  const decline =
    decisionRaw === "decline" ||
    decisionRaw === "reject" ||
    decisionRaw === "ablehnen";
  if (!approve && !decline) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Änderungsanfrage annehmen oder ablehnen?"
          : "Approve or decline the change request?",
    });
  }

  const guestName = String(args.guest_name ?? "").trim();
  const reservationId =
    typeof args.reservation_id === "string" ? args.reservation_id.trim() : "";

  let id = reservationId;
  let label = guestName;
  if (!id) {
    const lookup = await findReservationByGuest(
      ctx,
      target.restaurantId,
      guestName,
      typeof args.date_ymd === "string" ? args.date_ymd : null,
      locale,
    );
    if (!lookup.ok) {
      return assistantJson({ ok: false, ask: lookup.ask, error: lookup.error });
    }
    id = lookup.row.id;
    label = lookup.row.label;
  }

  const { data: row, error: loadErr } = await target.sb
    .from("reservations")
    .select(
      `id, reservation_number, guest_first_name, guest_last_name, guest_company,
       guest_phone, guest_email, party_size, starts_at, ends_at, dwell_minutes,
       dining_table_id, notify_email, notify_whatsapp, terms_accepted,
       pending_change, status_before_change_id,
       reservation_statuses ( id, code, name )`,
    )
    .eq("id", id)
    .eq("restaurant_id", target.restaurantId)
    .maybeSingle();
  if (loadErr) return assistantJson({ ok: false, error: loadErr.message });
  if (!row) {
    return assistantJson({ ok: false, error: "Reservierung nicht gefunden." });
  }
  const statusJoin = row.reservation_statuses as
    | { id: string; code: string; name: string }
    | { id: string; code: string; name: string }[]
    | null;
  const status = Array.isArray(statusJoin) ? statusJoin[0] : statusJoin;
  if (status?.code !== "change_requested") {
    return assistantJson({
      ok: false,
      error:
        locale === "de"
          ? "Keine offene Änderungsanfrage."
          : "No open change request.",
    });
  }
  const pending = parseReservationPendingChange(row.pending_change);
  if (!pending && approve) {
    return assistantJson({
      ok: false,
      error:
        locale === "de"
          ? "Änderungsdaten fehlen."
          : "Change request data missing.",
    });
  }

  label =
    `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim() ||
    label;

  const preview = {
    reservation_id: id,
    guest_name: label,
    decision: approve ? "approve" : "decline",
    date_ymd: typeof args.date_ymd === "string" ? args.date_ymd : null,
    pending_party_size: pending?.party_size ?? null,
    pending_starts_at: pending?.starts_at ?? null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "resolve_reservation_change_request",
      message:
        locale === "de"
          ? approve
            ? `Änderungsanfrage von ${label} annehmen`
            : `Änderungsanfrage von ${label} ablehnen`
          : approve
            ? `Approve change request from ${label}`
            : `Decline change request from ${label}`,
      preview,
    });
  }

  if (decline) {
    const { error } = await target.sb
      .from("reservations")
      .update({
        status_id: row.status_before_change_id,
        pending_change: null,
        status_before_change_id: null,
      })
      .eq("id", id)
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
    await insertReservationLogEntry(target.sb, {
      restaurantId: target.restaurantId,
      reservationId: id,
      actorUserId: ctx.userId,
      action: "change_request_declined",
      reservationNumber: row.reservation_number as number,
      guestLabel: formatReservationGuestLabel(
        row.reservation_number as number,
        row.guest_first_name as string,
        row.guest_last_name as string,
        (row.guest_company as string | null) ?? null,
      ),
      details: buildReservationLogDetails([], {
        actorSource: "staff",
        summary: "Änderungsanfrage abgelehnt",
      }),
    });
    return assistantJson({
      ok: true,
      status: "saved",
      message:
        locale === "de"
          ? `Änderungsanfrage von ${label} abgelehnt.`
          : `Change request from ${label} declined.`,
    });
  }

  const restoreStatusId = row.status_before_change_id as string | null;
  const relocatePatch = relocatedFromPatchOnDatetimeChange({
    beforeStartsAt: row.starts_at as string,
    beforeEndsAt: row.ends_at as string,
    afterStartsAt: pending!.starts_at,
    afterEndsAt: pending!.ends_at,
    beforeDiningTableId: (row.dining_table_id as string | null) ?? null,
  });
  const { error } = await target.sb
    .from("reservations")
    .update({
      guest_first_name: pending!.guest_first_name,
      guest_last_name: pending!.guest_last_name,
      guest_company: pending!.guest_company,
      guest_phone: pending!.guest_phone,
      guest_email: pending!.guest_email,
      party_size: pending!.party_size,
      starts_at: pending!.starts_at,
      ends_at: pending!.ends_at,
      dwell_minutes: pending!.dwell_minutes,
      notify_email: pending!.notify_email,
      notify_whatsapp: pending!.notify_whatsapp,
      terms_accepted: pending!.terms_accepted,
      status_id: restoreStatusId,
      pending_change: null,
      status_before_change_id: null,
      ...(relocatePatch ?? {}),
    })
    .eq("id", id)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });

  await insertReservationLogEntry(target.sb, {
    restaurantId: target.restaurantId,
    reservationId: id,
    actorUserId: ctx.userId,
    action: "change_request_approved",
    reservationNumber: row.reservation_number as number,
    guestLabel: formatReservationGuestLabel(
      row.reservation_number as number,
      pending!.guest_first_name,
      pending!.guest_last_name,
      pending!.guest_company,
    ),
    details: buildReservationLogDetails([], {
      actorSource: "staff",
      summary: "Änderungsanfrage angenommen",
    }),
  });

  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Änderungsanfrage von ${label} angenommen.`
        : `Change request from ${label} approved.`,
  });
}

export async function applyResolveReservationChangeRequestPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolResolveReservationChangeRequest(
    ctx,
    {
      reservation_id: preview.reservation_id,
      guest_name: preview.guest_name,
      date_ymd: preview.date_ymd,
      decision: preview.decision,
      confirm: true,
    },
    locale,
  );
}
