import {
  loadPublicReservationForManage,
  updatePublicReservation,
  type PublicReservationUpdateBody,
} from "@/lib/reservations/public-reservation-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
  } & PublicReservationUpdateBody;

  const action = body.action ?? "update";
  const slug = body.slug?.trim() ?? "";
  const reservationNumber = Number(body.reservation_number);
  const pin = body.pin?.trim() ?? "";

  if (!slug || !Number.isFinite(reservationNumber) || !pin) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (action === "load") {
    const result = await loadPublicReservationForManage(
      slug,
      reservationNumber,
      pin,
    );
    if (!result.data) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    const { id: _id, dining_table_id: _t, ...guest } = result.data;
    return Response.json({ reservation: guest });
  }

  const result = await updatePublicReservation({
    ...body,
    slug,
    reservation_number: reservationNumber,
    pin,
  });
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result.data);
}
