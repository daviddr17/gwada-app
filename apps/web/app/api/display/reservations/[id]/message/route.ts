import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchReservationContactMessagesServer } from "@/lib/contact-messages/fetch-reservation-contact-messages-server";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import {
  formatDisplayActorLabel,
  resolveDisplayReservationActor,
} from "@/lib/display/display-reservation-actor-server";
import { sendDisplayReservationMessage } from "@/lib/display/display-reservation-message-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;
  const result = await fetchReservationContactMessagesServer(admin, {
    restaurantId: access.restaurantId,
    reservationId: id,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ messages: result.data });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;

  let body: {
    messageBody?: string;
    sendWhatsapp?: boolean;
    sendEmail?: boolean;
    restaurantName?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const messageBody = body.messageBody?.trim() ?? "";
  if (!messageBody) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  const actor = await resolveDisplayReservationActor(admin, access.staffId);

  const result = await sendDisplayReservationMessage(admin, {
    restaurantId: access.restaurantId,
    reservationId: id,
    messageBody,
    sendWhatsapp: body.sendWhatsapp === true,
    sendEmail: body.sendEmail === true,
    sentByProfileId: actor.profileId,
    sentByLabel: formatDisplayActorLabel(actor),
    restaurantName: body.restaurantName?.trim() || null,
  });

  if (result.errors?.includes("not_found")) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 404 });
  }
  if (result.errors?.includes("no_contact")) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
  }

  return NextResponse.json(result);
}
