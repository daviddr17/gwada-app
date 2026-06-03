import { sendManualReviewInvitation } from "@/lib/reviews/review-invitation-send-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    invitationToken?: string;
    messageBody?: string;
    guestPhone?: string;
    guestEmail?: string;
    guestFirstName?: string;
    sendWhatsapp?: boolean;
    sendEmail?: boolean;
    restaurantName?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await sendManualReviewInvitation(admin, {
    restaurantId,
    invitationToken: body.invitationToken?.trim() ?? "",
    messageBody: body.messageBody?.trim() ?? "",
    guestPhone: body.guestPhone?.trim() || null,
    guestEmail: body.guestEmail?.trim() || null,
    guestFirstName: body.guestFirstName?.trim() || null,
    sendWhatsapp: Boolean(body.sendWhatsapp),
    sendEmail: Boolean(body.sendEmail),
    sentByUserId: user?.id ?? null,
    restaurantName: body.restaurantName?.trim() || null,
  });

  return Response.json(result);
}
