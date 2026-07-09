import { resolveRestaurantEmployeeId } from "@/lib/documents/document-log-server";
import {
  authorizeModuleCrud,
  authorizeRestaurantModule,
} from "@/lib/permissions/authorize-restaurant-module";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { RESERVATION_DAY_NOTE_MAX_LENGTH } from "@/lib/types/reservation-day-notes";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function authorizeReservationDayNotes(restaurantId: string) {
  const read = await authorizeModuleCrud(restaurantId, "reservations", "read");
  if (read.ok) return read;
  const manage = await authorizeRestaurantModule(
    restaurantId,
    "reservations.manage",
  );
  if (manage.ok) return manage;
  return read;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    serviceDate?: string;
    body?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const serviceDate = body.serviceDate?.trim() ?? "";
  const noteBody = typeof body.body === "string" ? body.body.trim() : "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !DATE_RE.test(serviceDate) ||
    !noteBody
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (noteBody.length > RESERVATION_DAY_NOTE_MAX_LENGTH) {
    return Response.json({ error: "note_too_long" }, { status: 400 });
  }

  const auth = await authorizeReservationDayNotes(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const employeeId = await resolveRestaurantEmployeeId(
    auth.sb,
    restaurantId,
    auth.userId,
  );

  const { data: inserted, error: insertError } = await auth.sb
    .from("restaurant_reservation_day_note_entries")
    .insert({
      restaurant_id: restaurantId,
      service_date: serviceDate,
      employee_id: employeeId,
      actor_user_id: auth.userId,
      body: noteBody,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return Response.json(
      { error: insertError?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, entryId: inserted.id as string });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    entryId?: string;
    body?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const entryId = body.entryId?.trim() ?? "";
  const noteBody = typeof body.body === "string" ? body.body.trim() : "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(entryId) ||
    !noteBody
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (noteBody.length > RESERVATION_DAY_NOTE_MAX_LENGTH) {
    return Response.json({ error: "note_too_long" }, { status: 400 });
  }

  const auth = await authorizeReservationDayNotes(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { data: entry, error: fetchError } = await auth.sb
    .from("restaurant_reservation_day_note_entries")
    .select("id, body, actor_user_id")
    .eq("id", entryId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }
  if (!entry) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if ((entry.actor_user_id as string) !== auth.userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const oldBody = (entry.body as string).trim();
  if (oldBody === noteBody) {
    return Response.json({ ok: true });
  }

  const { error: updateError } = await auth.sb
    .from("restaurant_reservation_day_note_entries")
    .update({ body: noteBody })
    .eq("id", entryId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    entryId?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const entryId = body.entryId?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(entryId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeReservationDayNotes(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { data: entry, error: fetchError } = await auth.sb
    .from("restaurant_reservation_day_note_entries")
    .select("id, actor_user_id")
    .eq("id", entryId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }
  if (!entry) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if ((entry.actor_user_id as string) !== auth.userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await auth.sb
    .from("restaurant_reservation_day_note_entries")
    .delete()
    .eq("id", entryId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
