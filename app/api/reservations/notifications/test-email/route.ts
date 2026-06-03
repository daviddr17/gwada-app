import { authorizeReservationSettingsRestaurant } from "@/lib/reservations/reservation-settings-route-auth";
import {
  isWhatsappMessageKind,
  sendReservationNotificationTestEmail,
} from "@/lib/reservations/reservation-notification-test-server";
import type { ReviewRequestIncludes } from "@/lib/reviews/review-request-settings";

export const dynamic = "force-dynamic";

function parseReviewIncludes(raw: unknown): ReviewRequestIncludes | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    includeGwada: o.includeGwada !== false,
    includeGoogle: Boolean(o.includeGoogle),
    includeFacebook: Boolean(o.includeFacebook),
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    kind?: string;
    to?: string;
    template?: string;
    subject?: string;
    emailSenderName?: string | null;
    guestManageUrlTemplate?: string | null;
    reviewIncludes?: unknown;
    reviewGoogleUrl?: string | null;
    reviewFacebookUrl?: string | null;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const kind = body.kind?.trim() ?? "";
  const to = body.to?.trim() ?? "";

  if (!isWhatsappMessageKind(kind)) {
    return Response.json({ error: "invalid_kind" }, { status: 400 });
  }
  if (!to) {
    return Response.json({ error: "missing_recipient" }, { status: 400 });
  }

  const auth = await authorizeReservationSettingsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await sendReservationNotificationTestEmail({
    restaurantId,
    kind,
    toEmail: to,
    template: typeof body.template === "string" ? body.template : "",
    subject: typeof body.subject === "string" ? body.subject : "",
    emailSenderName:
      typeof body.emailSenderName === "string"
        ? body.emailSenderName.trim() || null
        : null,
    guestManageUrlTemplate:
      typeof body.guestManageUrlTemplate === "string"
        ? body.guestManageUrlTemplate.trim() || null
        : null,
    reviewIncludes: parseReviewIncludes(body.reviewIncludes),
    reviewGoogleUrl:
      typeof body.reviewGoogleUrl === "string" ? body.reviewGoogleUrl : null,
    reviewFacebookUrl:
      typeof body.reviewFacebookUrl === "string" ? body.reviewFacebookUrl : null,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
