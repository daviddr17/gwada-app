import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  splitPersonName,
  touchContactRow,
} from "@/lib/contacts/contact-identity-resolver";
import { resolveContactIdForGwadaReview } from "@/lib/reviews/contact-gwada-review-server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("gwada_review_invitations")
    .select("id, restaurant_id, completed_at, expires_at")
    .eq("token", token.trim())
    .maybeSingle();

  if (error || !data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("name")
    .eq("id", data.restaurant_id as string)
    .maybeSingle();

  const expired = new Date(data.expires_at as string).getTime() < Date.now();
  const completed = Boolean(data.completed_at);

  return Response.json({
    restaurantName:
      (restaurant?.name as string | undefined)?.trim() || "Restaurant",
    expired,
    completed,
    canSubmit: !expired && !completed,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  let body: { rating?: number; comment?: string; guestName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "invalid_rating" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: inv, error: invErr } = await admin
    .from("gwada_review_invitations")
    .select("id, restaurant_id, reservation_id, completed_at, expires_at")
    .eq("token", token.trim())
    .maybeSingle();

  if (invErr || !inv) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (inv.completed_at) {
    return Response.json({ error: "already_submitted" }, { status: 409 });
  }

  if (new Date(inv.expires_at as string).getTime() < Date.now()) {
    return Response.json({ error: "expired" }, { status: 410 });
  }

  const { data: inserted, error: reviewErr } = await admin
    .from("gwada_reviews")
    .insert({
      restaurant_id: inv.restaurant_id,
      reservation_id: inv.reservation_id,
      invitation_id: inv.id,
      rating: Math.round(rating),
      comment: body.comment?.trim() || null,
      guest_display_name: body.guestName?.trim() || null,
    })
    .select("id, rating, comment, guest_display_name, created_at")
    .single();

  if (reviewErr) {
    return Response.json({ error: reviewErr.message }, { status: 500 });
  }

  await admin
    .from("gwada_review_invitations")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", inv.id);

  const contactId = await resolveContactIdForGwadaReview(admin, {
    restaurantId: inv.restaurant_id as string,
    reservationId: (inv.reservation_id as string | null) ?? null,
    invitationToken: token.trim(),
  });
  if (contactId) {
    const guestName = body.guestName?.trim();
    await touchContactRow(
      admin,
      contactId,
      guestName ? splitPersonName(guestName) : undefined,
    );
  }

  if (inserted) {
    const { tryAutoReplyToReview } = await import(
      "@/lib/reviews/review-auto-reply-server"
    );
    void tryAutoReplyToReview(inv.restaurant_id as string, {
      id: inserted.id as string,
      platform: "gwada",
      rating: Number(inserted.rating),
      comment: (inserted.comment as string | null) ?? null,
      authorName: (inserted.guest_display_name as string | null) ?? null,
      createdAt: inserted.created_at as string,
      reply: null,
      canReply: true,
      externalUrl: null,
    });
  }

  return Response.json({ ok: true });
}
