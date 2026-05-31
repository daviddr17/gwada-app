import {
  createPublicReservation,
  type PublicReservationCreateBody,
} from "@/lib/reservations/public-reservation-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PublicReservationCreateBody;
  const result = await createPublicReservation(body);
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result.data);
}
