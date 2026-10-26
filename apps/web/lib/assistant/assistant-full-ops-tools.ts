import "server-only";

import { ASSISTANT_LIST_CAP, assistantAsk, assistantAskWhich } from "@/lib/assistant/assistant-ask";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import {
  assistantJson,
  denyUnlessModuleCrud,
  denyUnlessPermission,
  draftMutation,
} from "@/lib/assistant/assistant-tool-auth";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { fetchContactThreadPageServer } from "@/lib/contact-messages/fetch-contact-thread-server";
import { markConversationReadDbServer } from "@/lib/contact-messages/mark-conversation-read-server";
import { insertContactServer } from "@/lib/contacts/contacts-server";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import { createAndPublishEvent } from "@/lib/events/events-publish-server";
import { updateGwadaEvent } from "@/lib/events/events-update-server";
import { createAndPublishNewsPost } from "@/lib/news/news-publish-server";
import { replyToFacebookRecommendation } from "@/lib/reviews/facebook-reviews-api";
import { replyToGoogleReview } from "@/lib/reviews/google-reviews-api";
import { updateCachedReviewReply } from "@/lib/reviews/review-auto-reply-server";
import { reviewExternalId } from "@/lib/reviews/review-settings-types";
import {
  markReviewReadServer,
  markReviewUnreadServer,
} from "@/lib/reviews/mark-review-read-server";
import {
  restaurantIsoToYmdHm,
  restaurantTodayYmd,
  ymdHmToRestaurantIso,
} from "@/lib/restaurant/restaurant-timezone";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import {
  ensureAccountingCashBookDefaults,
  listAccountingCashCategories,
  upsertAccountingCashEntry,
} from "@/lib/accounting/accounting-cash-book-server";
import { resolveRestaurantEmployeeId } from "@/lib/documents/document-log-server";
import type { AppLocale } from "@/i18n/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/* ─── shared resolve helpers ─────────────────────────────────────── */

async function resolveContact(
  sb: SupabaseClient,
  restaurantId: string,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<
  | { ok: true; id: string; label: string }
  | { ok: false; ask?: string; error?: string }
> {
  const id = typeof args.contact_id === "string" ? args.contact_id.trim() : "";
  if (id) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, first_name, last_name, company")
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, ask: assistantAsk(locale, "guest") };
    return {
      ok: true,
      id: data.id as string,
      label:
        [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
        String(data.company ?? id),
    };
  }
  const name = String(args.contact_name ?? args.name ?? "").trim();
  if (!name) {
    return {
      ok: false,
      ask:
        locale === "de"
          ? "Welchen Kontakt meinst du?"
          : "Which contact?",
    };
  }
  const q = name.replace(/[%_,]/g, "");
  const { data, error } = await sb
    .from("contacts")
    .select("id, first_name, last_name, company")
    .eq("restaurant_id", restaurantId)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`)
    .limit(6);
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      ask:
        locale === "de"
          ? "Welchen Kontakt meinst du?"
          : "Which contact?",
    };
  }
  if (rows.length > 1) {
    return {
      ok: false,
      ask: assistantAskWhich(
        locale,
        "which",
        rows.map(
          (r) =>
            [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
            String(r.company ?? "?"),
        ),
      ),
    };
  }
  const row = rows[0]!;
  return {
    ok: true,
    id: row.id as string,
    label:
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
      String(row.company ?? name),
  };
}

async function resolveStaffMember(
  sb: SupabaseClient,
  restaurantId: string,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<
  | { ok: true; id: string; label: string }
  | { ok: false; ask?: string; error?: string }
> {
  const id = typeof args.staff_id === "string" ? args.staff_id.trim() : "";
  if (id) {
    const { data, error } = await sb
      .from("restaurant_staff")
      .select("id, given_name, family_name")
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) {
      return {
        ok: false,
        ask: locale === "de" ? "Welchen Mitarbeiter?" : "Which staff member?",
      };
    }
    return {
      ok: true,
      id: data.id as string,
      label: `${data.given_name ?? ""} ${data.family_name ?? ""}`.trim(),
    };
  }
  const name = String(args.name ?? args.staff_name ?? "").trim();
  if (!name) {
    return {
      ok: false,
      ask: locale === "de" ? "Welchen Mitarbeiter?" : "Which staff member?",
    };
  }
  const q = name.replace(/[%_,]/g, "");
  const { data, error } = await sb
    .from("restaurant_staff")
    .select("id, given_name, family_name")
    .eq("restaurant_id", restaurantId)
    .or(`given_name.ilike.%${q}%,family_name.ilike.%${q}%`)
    .limit(6);
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      ask: locale === "de" ? "Welchen Mitarbeiter?" : "Which staff member?",
    };
  }
  if (rows.length > 1) {
    return {
      ok: false,
      ask: assistantAskWhich(
        locale,
        "which",
        rows.map((r) => `${r.given_name ?? ""} ${r.family_name ?? ""}`.trim()),
      ),
    };
  }
  return {
    ok: true,
    id: rows[0]!.id as string,
    label: `${rows[0]!.given_name ?? ""} ${rows[0]!.family_name ?? ""}`.trim(),
  };
}

/* ─── contacts ───────────────────────────────────────────────────── */

export async function toolUpsertContact(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }

  const mode = String(args.mode ?? (args.contact_id ? "update" : "create")).toLowerCase();
  const isUpdate = mode === "update" || mode === "edit";
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "contacts",
    isUpdate ? "update" : "create",
    isUpdate
      ? "Keine Berechtigung, Kontakte zu ändern."
      : "Keine Berechtigung, Kontakte anzulegen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  let contactId =
    typeof args.contact_id === "string" ? args.contact_id.trim() : "";
  if (isUpdate && !contactId) {
    const found = await resolveContact(target.sb, target.restaurantId, args, locale);
    if (!found.ok) return assistantJson({ ok: false, ask: found.ask, error: found.error });
    contactId = found.id;
  }

  const firstName = String(args.first_name ?? args.guest_first_name ?? "").trim() || "Gast";
  const lastName = String(args.last_name ?? args.guest_last_name ?? "").trim();
  const email = String(args.email ?? "").trim();
  const phone = String(args.phone ?? args.guest_phone ?? "").trim();
  const notes = args.notes == null ? null : String(args.notes).trim() || null;
  const company = args.company == null ? null : String(args.company).trim() || null;

  if (!isUpdate && !email && !phone) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "E-Mail oder Telefon für den neuen Kontakt?"
          : "Email or phone for the new contact?",
    });
  }

  const emails = email
    ? [{ email, isPrimary: true }]
    : [];
  const phones = phone
    ? [{ phoneDisplay: phone, isPrimary: true }]
    : [];

  const preview = {
    mode: isUpdate ? "update" : "create",
    contact_id: contactId || null,
    first_name: firstName,
    last_name: lastName,
    email: email || null,
    phone: phone || null,
    company,
    notes,
  };

  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "upsert_contact",
      message:
        locale === "de"
          ? isUpdate
            ? `Kontakt ${firstName} ${lastName} ändern`
            : `Kontakt ${firstName} ${lastName} anlegen`
          : isUpdate
            ? `Update contact ${firstName} ${lastName}`
            : `Create contact ${firstName} ${lastName}`,
      preview,
    });
  }

  if (isUpdate) {
    const patch: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
    };
    if (company !== undefined) patch.company = company;
    if (notes !== undefined) patch.notes = notes;
    const { error } = await target.sb
      .from("contacts")
      .update(patch)
      .eq("id", contactId)
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
    if (email) {
      const norm = normalizeContactEmail(email);
      if (norm) {
        await target.sb.from("contact_emails").delete().eq("contact_id", contactId);
        await target.sb.from("contact_emails").insert({
          contact_id: contactId,
          restaurant_id: target.restaurantId,
          email,
          email_normalized: norm,
          is_primary: true,
          sort_order: 0,
        });
      }
    }
    if (phone) {
      const norm = normalizeContactPhone(phone);
      await target.sb.from("contact_phones").delete().eq("contact_id", contactId);
      await target.sb.from("contact_phones").insert({
        contact_id: contactId,
        restaurant_id: target.restaurantId,
        phone_display: phone,
        phone_normalized: norm,
        is_primary: true,
        sort_order: 0,
      });
    }
    return assistantJson({
      ok: true,
      status: "saved",
      message:
        locale === "de"
          ? `Kontakt ${firstName} ${lastName} aktualisiert.`
          : `Contact ${firstName} ${lastName} updated.`,
    });
  }

  const inserted = await insertContactServer(target.sb, {
    restaurantId: target.restaurantId,
    firstName,
    lastName,
    company,
    notes,
    emails,
    phones,
  });
  if (inserted.error || !inserted.data) {
    return assistantJson({
      ok: false,
      error: inserted.error?.message ?? "Kontakt konnte nicht angelegt werden.",
    });
  }
  return assistantJson({
    ok: true,
    status: "saved",
    contact_id: inserted.data.id,
    message:
      locale === "de"
        ? `Kontakt ${firstName} ${lastName} angelegt.`
        : `Contact ${firstName} ${lastName} created.`,
  });
}

export async function applyUpsertContactPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpsertContact(ctx, { ...preview, confirm: true }, locale);
}

export async function toolDeleteContact(
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
    "contacts",
    "delete",
    "Keine Berechtigung, Kontakte zu löschen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const found = await resolveContact(target.sb, target.restaurantId, args, locale);
  if (!found.ok) return assistantJson({ ok: false, ask: found.ask, error: found.error });

  const preview = { contact_id: found.id, contact_name: found.label };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "delete_contact",
      message:
        locale === "de"
          ? `Kontakt ${found.label} löschen`
          : `Delete contact ${found.label}`,
      preview,
    });
  }
  const { error } = await target.sb
    .from("contacts")
    .delete()
    .eq("id", found.id)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Kontakt ${found.label} gelöscht.`
        : `Contact ${found.label} deleted.`,
  });
}

export async function applyDeleteContactPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolDeleteContact(ctx, { ...preview, confirm: true }, locale);
}

export async function toolReadContactThread(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "contacts",
    "read",
    "Keine Berechtigung für Nachrichten.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const found = await resolveContact(target.sb, target.restaurantId, args, locale);
  if (!found.ok) return assistantJson({ ok: false, ask: found.ask, error: found.error });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return assistantJson({ ok: false, error: "Server nicht konfiguriert." });
  }
  const page = await fetchContactThreadPageServer(admin, {
    restaurantId: target.restaurantId,
    contactId: found.id,
    limit: ASSISTANT_LIST_CAP,
  });
  if (page.error) return assistantJson({ ok: false, error: page.error });

  return assistantJson({
    ok: true,
    contact: found.label,
    contact_id: found.id,
    messages: (page.messages ?? []).slice(-ASSISTANT_LIST_CAP).map((m) => ({
      direction: m.direction,
      platform: m.platform,
      body: String(m.body ?? "").slice(0, 280),
      created_at: m.created_at,
    })),
    has_more: page.hasMore,
  });
}

export async function toolMarkContactThreadRead(
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
    "contacts",
    "read",
    "Keine Berechtigung für Nachrichten.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const found = await resolveContact(target.sb, target.restaurantId, args, locale);
  if (!found.ok) return assistantJson({ ok: false, ask: found.ask, error: found.error });

  const platform = String(args.platform ?? "whatsapp").toLowerCase();
  const preview = {
    contact_id: found.id,
    contact_name: found.label,
    platform,
    conversation_key: found.id,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "mark_contact_thread_read",
      message:
        locale === "de"
          ? `Thread ${found.label} als gelesen markieren`
          : `Mark thread ${found.label} as read`,
      preview,
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return assistantJson({ ok: false, error: "Server nicht konfiguriert." });
  const result = await markConversationReadDbServer(admin, {
    restaurantId: target.restaurantId,
    userId: ctx.userId,
    conversationKey: found.id,
    platform: platform as "whatsapp" | "email" | "gwada" | "facebook" | "instagram",
  });
  if (result.error) return assistantJson({ ok: false, error: result.error });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Thread ${found.label} als gelesen markiert.`
        : `Thread ${found.label} marked read.`,
  });
}

export async function applyMarkContactThreadReadPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolMarkContactThreadRead(ctx, { ...preview, confirm: true }, locale);
}

/* ─── reviews ────────────────────────────────────────────────────── */

export async function toolReplyToReview(
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
    "reviews",
    "update",
    "Keine Berechtigung, Bewertungen zu beantworten.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const platform = String(args.platform ?? "google").toLowerCase();
  const reviewId = String(args.review_id ?? args.id ?? "").trim();
  const comment = String(args.comment ?? args.body ?? args.reply ?? "").trim();
  if (!reviewId) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welche Bewertung (review_id)?"
          : "Which review (review_id)?",
    });
  }
  if (!comment) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welche Antwort soll ich schreiben?"
          : "What reply should I post?",
    });
  }

  const preview = {
    platform,
    review_id: reviewId,
    comment,
  };
  if (!args.confirm) {
    const snip = comment.length > 100 ? `${comment.slice(0, 97)}…` : comment;
    return draftMutation({
      locale,
      action: "reply_to_review",
      message:
        locale === "de"
          ? `Antwort auf ${platform}-Bewertung: „${snip}“`
          : `Reply to ${platform} review: “${snip}”`,
      preview,
    });
  }

  const admin = createSupabaseAdminClient();
  if (platform === "google") {
    const result = await replyToGoogleReview({
      restaurantId: target.restaurantId,
      reviewName: reviewId,
      comment,
    });
    if ("error" in result) return assistantJson({ ok: false, error: result.error });
    if (admin) {
      await updateCachedReviewReply(
        admin,
        target.restaurantId,
        "google",
        reviewExternalId({ id: reviewId, platform: "google" }),
        comment,
      );
    }
  } else if (platform === "facebook") {
    const result = await replyToFacebookRecommendation({
      restaurantId: target.restaurantId,
      storyId: reviewId,
      message: comment,
    });
    if ("error" in result) return assistantJson({ ok: false, error: result.error });
    if (admin) {
      await updateCachedReviewReply(
        admin,
        target.restaurantId,
        "facebook",
        reviewExternalId({ id: reviewId, platform: "facebook" }),
        comment,
      );
    }
  } else if (platform === "gwada") {
    if (!admin) return assistantJson({ ok: false, error: "Server nicht konfiguriert." });
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("gwada_reviews")
      .update({ owner_reply: comment, owner_reply_at: now })
      .eq("id", reviewId)
      .eq("restaurant_id", target.restaurantId)
      .is("owner_reply", null)
      .select("id")
      .maybeSingle();
    if (error) return assistantJson({ ok: false, error: error.message });
    if (!data) return assistantJson({ ok: false, error: "already_replied" });
  } else {
    return assistantJson({ ok: false, error: `Unbekannte Plattform: ${platform}` });
  }

  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? "Antwort auf die Bewertung veröffentlicht."
        : "Review reply published.",
  });
}

export async function applyReplyToReviewPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolReplyToReview(ctx, { ...preview, confirm: true }, locale);
}

export async function toolMarkReviewRead(
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
    "reviews",
    "read",
    "Keine Berechtigung für Bewertungen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const platform = String(args.platform ?? "google").toLowerCase();
  const reviewId = String(args.review_id ?? args.id ?? "").trim();
  const unread = args.unread === true || String(args.mode ?? "") === "unread";
  if (!reviewId) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welche Bewertung (review_id)?"
          : "Which review (review_id)?",
    });
  }

  const preview = { platform, review_id: reviewId, unread };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "mark_review_read",
      message:
        locale === "de"
          ? unread
            ? `Bewertung als ungelesen markieren`
            : `Bewertung als gelesen markieren`
          : unread
            ? `Mark review unread`
            : `Mark review read`,
      preview,
    });
  }

  const fn = unread ? markReviewUnreadServer : markReviewReadServer;
  const result = await fn(target.sb, {
    restaurantId: target.restaurantId,
    userId: ctx.userId,
    platform: platform as "google" | "facebook" | "gwada",
    reviewId,
  });
  if (result.error) return assistantJson({ ok: false, error: result.error });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? unread
          ? "Als ungelesen markiert."
          : "Als gelesen markiert."
        : unread
          ? "Marked unread."
          : "Marked read.",
  });
}

export async function applyMarkReviewReadPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolMarkReviewRead(ctx, { ...preview, confirm: true }, locale);
}

/* ─── news / events ──────────────────────────────────────────────── */

export async function toolUpsertNewsPost(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const publish =
    args.publish === true ||
    String(args.mode ?? "").toLowerCase() === "publish";
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "news",
    "create",
    "Keine Berechtigung für News.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const title = String(args.title ?? "").trim() || null;
  const body = String(args.body ?? args.text ?? "").trim();
  if (!body) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Welcher News-Text?" : "What news body?",
    });
  }
  const platformsRaw = args.platforms;
  const platforms = Array.isArray(platformsRaw)
    ? platformsRaw.map((p) => String(p).toLowerCase())
    : String(platformsRaw ?? (publish ? "gwada" : ""))
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);

  const preview = {
    title,
    body,
    platforms,
    publish,
    post_id: typeof args.post_id === "string" ? args.post_id : null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "upsert_news_post",
      message:
        locale === "de"
          ? publish
            ? `News veröffentlichen: ${title ?? body.slice(0, 40)}`
            : `News-Entwurf speichern: ${title ?? body.slice(0, 40)}`
          : publish
            ? `Publish news: ${title ?? body.slice(0, 40)}`
            : `Save news draft: ${title ?? body.slice(0, 40)}`,
      preview,
    });
  }

  if (publish) {
    const result = await createAndPublishNewsPost(target.sb, {
      restaurantId: target.restaurantId,
      userId: ctx.userId,
      postId: preview.post_id ?? undefined,
      title,
      body,
      media: [],
      scheduledAt: null,
      platforms: (platforms.length ? platforms : ["gwada"]) as never[],
    });
    if (!result.ok) return assistantJson({ ok: false, error: result.error });
    return assistantJson({
      ok: true,
      status: "saved",
      post_id: result.postId,
      message:
        locale === "de" ? "News veröffentlicht." : "News published.",
    });
  }

  const { data, error } = await target.sb
    .from("gwada_news_posts")
    .insert({
      restaurant_id: target.restaurantId,
      title,
      body,
      media: [],
      status: "draft",
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    post_id: data.id,
    message: locale === "de" ? "News-Entwurf gespeichert." : "News draft saved.",
  });
}

export async function applyUpsertNewsPostPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpsertNewsPost(ctx, { ...preview, confirm: true }, locale);
}

export async function toolUpsertEvent(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const publish =
    args.publish === true ||
    String(args.mode ?? "").toLowerCase() === "publish";
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "events",
    "create",
    "Keine Berechtigung für Events.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const title = String(args.title ?? "").trim();
  const description = String(args.description ?? args.body ?? "").trim();
  const dateYmd = String(args.date_ymd ?? args.start_ymd ?? "").trim();
  const timeHm = String(args.time_hm ?? args.start_hm ?? "18:00").trim();
  if (!title) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Welcher Event-Titel?" : "What event title?",
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichDate") });
  }

  const timeZone = await fetchRestaurantTimezoneServer(
    target.sb,
    target.restaurantId,
  );
  let startAt: string;
  try {
    startAt = ymdHmToRestaurantIso(dateYmd, timeHm, timeZone);
  } catch {
    return assistantJson({ ok: false, error: "Ungültiges Datum/Uhrzeit." });
  }

  const platformsRaw = args.platforms;
  const platforms = Array.isArray(platformsRaw)
    ? platformsRaw.map((p) => String(p).toLowerCase())
    : String(platformsRaw ?? (publish ? "gwada" : ""))
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);

  const preview = {
    title,
    description,
    date_ymd: dateYmd,
    time_hm: timeHm,
    start_at: startAt,
    location: args.location == null ? null : String(args.location),
    platforms,
    publish,
    event_id: typeof args.event_id === "string" ? args.event_id : null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "upsert_event",
      message:
        locale === "de"
          ? publish
            ? `Event veröffentlichen: ${title} (${dateYmd} ${timeHm})`
            : `Event-Entwurf: ${title} (${dateYmd} ${timeHm})`
          : publish
            ? `Publish event: ${title}`
            : `Event draft: ${title}`,
      preview,
    });
  }

  if (publish) {
    const result = await createAndPublishEvent(target.sb, {
      restaurantId: target.restaurantId,
      userId: ctx.userId,
      eventId: preview.event_id ?? undefined,
      title,
      description,
      startAt,
      endAt: null,
      ticketUrl: null,
      location: preview.location,
      coverStoragePath: null,
      coverMimeType: null,
      scheduledAt: null,
      platforms: (platforms.length ? platforms : ["gwada"]) as never[],
    });
    if (!result.ok) return assistantJson({ ok: false, error: result.error });
    return assistantJson({
      ok: true,
      status: "saved",
      event_id: result.eventId,
      message: locale === "de" ? "Event veröffentlicht." : "Event published.",
    });
  }

  if (preview.event_id) {
    const updated = await updateGwadaEvent(target.sb, {
      restaurantId: target.restaurantId,
      eventId: preview.event_id,
      userId: ctx.userId,
      title,
      description,
      startAt,
      location: preview.location,
    });
    if (!updated.ok) return assistantJson({ ok: false, error: updated.error });
    return assistantJson({
      ok: true,
      status: "saved",
      message: locale === "de" ? "Event aktualisiert." : "Event updated.",
    });
  }

  const { data, error } = await target.sb
    .from("gwada_events")
    .insert({
      restaurant_id: target.restaurantId,
      title,
      description,
      start_at: startAt,
      location: preview.location,
      status: "draft",
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    event_id: data.id,
    message: locale === "de" ? "Event-Entwurf gespeichert." : "Event draft saved.",
  });
}

export async function applyUpsertEventPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpsertEvent(ctx, { ...preview, confirm: true }, locale);
}

/* ─── inventory ──────────────────────────────────────────────────── */

export async function toolUpsertIngredient(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const name = String(args.name ?? args.ingredient_name ?? "").trim();
  const mode = String(args.mode ?? "create").toLowerCase();
  const isUpdate = mode === "update" || mode === "edit" || Boolean(args.ingredient_id);
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "inventory",
    isUpdate ? "update" : "create",
    "Keine Berechtigung für Bestand.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  if (!name) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Welche Zutat?" : "Which ingredient?",
    });
  }

  let ingredientId =
    typeof args.ingredient_id === "string" ? args.ingredient_id.trim() : "";
  if (isUpdate && !ingredientId) {
    const q = name.replace(/[%_,]/g, "");
    const { data, error } = await target.sb
      .from("inventory_ingredients")
      .select("id, name, unit, current_stock")
      .eq("restaurant_id", target.restaurantId)
      .ilike("name", `%${q}%`)
      .limit(6);
    if (error) return assistantJson({ ok: false, error: error.message });
    const rows = data ?? [];
    if (rows.length !== 1) {
      return assistantJson({
        ok: false,
        ask:
          rows.length === 0
            ? locale === "de"
              ? "Welche Zutat?"
              : "Which ingredient?"
            : assistantAskWhich(
                locale,
                "which",
                rows.map((r) => String(r.name)),
              ),
      });
    }
    ingredientId = rows[0]!.id as string;
  }

  const unit = String(args.unit ?? "kg").trim() || "kg";
  const stock =
    args.current_stock != null ? Number(args.current_stock) : undefined;
  const newName =
    typeof args.new_name === "string" && args.new_name.trim()
      ? args.new_name.trim()
      : name;

  const preview = {
    mode: isUpdate ? "update" : "create",
    ingredient_id: ingredientId || null,
    name: newName,
    unit,
    current_stock: stock ?? null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "upsert_ingredient",
      message:
        locale === "de"
          ? isUpdate
            ? `Zutat ${newName} ändern`
            : `Zutat ${newName} anlegen (${unit})`
          : isUpdate
            ? `Update ingredient ${newName}`
            : `Create ingredient ${newName}`,
      preview,
    });
  }

  if (isUpdate) {
    const patch: Record<string, unknown> = { name: newName, unit };
    if (stock != null && Number.isFinite(stock)) patch.current_stock = stock;
    const { error } = await target.sb
      .from("inventory_ingredients")
      .update(patch)
      .eq("id", ingredientId)
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
    return assistantJson({
      ok: true,
      status: "saved",
      message:
        locale === "de"
          ? `Zutat ${newName} aktualisiert.`
          : `Ingredient ${newName} updated.`,
    });
  }

  const { data, error } = await target.sb
    .from("inventory_ingredients")
    .insert({
      restaurant_id: target.restaurantId,
      name: newName,
      unit,
      current_stock: stock != null && Number.isFinite(stock) ? stock : 0,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    ingredient_id: data.id,
    message:
      locale === "de"
        ? `Zutat ${newName} angelegt.`
        : `Ingredient ${newName} created.`,
  });
}

export async function applyUpsertIngredientPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpsertIngredient(ctx, { ...preview, confirm: true }, locale);
}

export async function toolCreatePurchaseOrder(
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
    "inventory",
    "create",
    "Keine Berechtigung für Bestellungen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const supplier = String(args.supplier ?? args.supplier_name ?? "").trim();
  if (!supplier) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Welcher Lieferant?" : "Which supplier?",
    });
  }

  const linesRaw = args.lines ?? args.items;
  const lines: Array<{ ingredient: string; quantity: number; unit?: string }> =
    [];
  if (Array.isArray(linesRaw)) {
    for (const row of linesRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const ingredient = String(r.ingredient ?? r.name ?? "").trim();
      const quantity = Number(r.quantity ?? r.qty ?? r.amount);
      if (!ingredient || !Number.isFinite(quantity) || quantity <= 0) continue;
      lines.push({
        ingredient,
        quantity,
        unit: r.unit == null ? undefined : String(r.unit),
      });
    }
  }
  if (!lines.length) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welche Positionen? (lines: [{ingredient, quantity}])"
          : "Which lines? (lines: [{ingredient, quantity}])",
    });
  }

  const preview = { supplier, lines };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "create_purchase_order",
      message:
        locale === "de"
          ? `Bestellung ${supplier}: ${lines.length} Position(en)`
          : `Order ${supplier}: ${lines.length} line(s)`,
      preview,
    });
  }

  const supplierId = randomUUID();
  const orderId = randomUUID();
  const { error: ordErr } = await target.sb
    .from("inventory_purchase_orders")
    .insert({
      id: orderId,
      restaurant_id: target.restaurantId,
      supplier_id: supplierId,
      supplier_name: supplier,
      status: "open",
      created_by: ctx.userId,
    });
  if (ordErr) return assistantJson({ ok: false, error: ordErr.message });

  for (const line of lines) {
    const q = line.ingredient.replace(/[%_,]/g, "");
    const { data: ings } = await target.sb
      .from("inventory_ingredients")
      .select("id, name, unit")
      .eq("restaurant_id", target.restaurantId)
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(1);
    const ing = ings?.[0];
    const { error: lineErr } = await target.sb
      .from("inventory_purchase_order_lines")
      .insert({
        id: randomUUID(),
        restaurant_id: target.restaurantId,
        order_id: orderId,
        ingredient_id: (ing?.id as string | undefined) ?? randomUUID(),
        ingredient_name: String(ing?.name ?? line.ingredient),
        brand_label: "",
        quantity: line.quantity,
        unit_id: "u",
        unit_label: line.unit ?? String(ing?.unit ?? "Stk"),
      });
    if (lineErr) return assistantJson({ ok: false, error: lineErr.message });
  }

  return assistantJson({
    ok: true,
    status: "saved",
    order_id: orderId,
    message:
      locale === "de"
        ? `Bestellung ${supplier} angelegt.`
        : `Order ${supplier} created.`,
  });
}

export async function applyCreatePurchaseOrderPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolCreatePurchaseOrder(ctx, { ...preview, confirm: true }, locale);
}

/* ─── staff / shifts ─────────────────────────────────────────────── */

export async function toolCreateStaff(
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
    "staff",
    "create",
    "Keine Berechtigung, Mitarbeiter anzulegen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const given = String(args.given_name ?? args.first_name ?? "").trim();
  const family = String(args.family_name ?? args.last_name ?? "").trim();
  if (!given || !family) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Vor- und Nachname des Mitarbeiters?"
          : "Staff given and family name?",
    });
  }
  const preview = {
    given_name: given,
    family_name: family,
    email: args.email == null ? null : String(args.email).trim() || null,
    phone: args.phone == null ? null : String(args.phone).trim() || null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "create_staff",
      message:
        locale === "de"
          ? `Mitarbeiter ${given} ${family} anlegen`
          : `Create staff ${given} ${family}`,
      preview,
    });
  }
  const { data, error } = await target.sb
    .from("restaurant_staff")
    .insert({
      restaurant_id: target.restaurantId,
      given_name: given,
      family_name: family,
      email: preview.email,
      phone: preview.phone,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    staff_id: data.id,
    message:
      locale === "de"
        ? `Mitarbeiter ${given} ${family} angelegt.`
        : `Staff ${given} ${family} created.`,
  });
}

export async function applyCreateStaffPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolCreateStaff(ctx, { ...preview, confirm: true }, locale);
}

export async function toolDeleteStaff(
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
    "staff",
    "delete",
    "Keine Berechtigung, Mitarbeiter zu löschen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const found = await resolveStaffMember(
    target.sb,
    target.restaurantId,
    args,
    locale,
  );
  if (!found.ok) return assistantJson({ ok: false, ask: found.ask, error: found.error });
  const preview = { staff_id: found.id, name: found.label };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "delete_staff",
      message:
        locale === "de"
          ? `Mitarbeiter ${found.label} löschen`
          : `Delete staff ${found.label}`,
      preview,
    });
  }
  const { error } = await target.sb
    .from("restaurant_staff")
    .delete()
    .eq("id", found.id)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Mitarbeiter ${found.label} gelöscht.`
        : `Staff ${found.label} deleted.`,
  });
}

export async function applyDeleteStaffPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolDeleteStaff(ctx, { ...preview, confirm: true }, locale);
}

export async function toolUpsertStaffShift(
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
    "staff",
    "update",
    "Keine Berechtigung für den Schichtplan.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const found = await resolveStaffMember(
    target.sb,
    target.restaurantId,
    args,
    locale,
  );
  if (!found.ok) return assistantJson({ ok: false, ask: found.ask, error: found.error });

  const dateYmd = String(args.date_ymd ?? "").trim();
  const startHm = String(args.start_hm ?? args.time_hm ?? "").trim();
  const endHm = String(args.end_hm ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || !startHm || !endHm) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Datum, Start- und Endzeit der Schicht?"
          : "Shift date, start and end time?",
    });
  }
  const timeZone = await fetchRestaurantTimezoneServer(
    target.sb,
    target.restaurantId,
  );
  let startsAt: string;
  let endsAt: string;
  try {
    startsAt = ymdHmToRestaurantIso(dateYmd, startHm, timeZone);
    endsAt = ymdHmToRestaurantIso(dateYmd, endHm, timeZone);
  } catch {
    return assistantJson({ ok: false, error: "Ungültige Schichtzeiten." });
  }

  const shiftId =
    typeof args.shift_id === "string" ? args.shift_id.trim() : "";
  const preview = {
    shift_id: shiftId || null,
    staff_id: found.id,
    staff_name: found.label,
    date_ymd: dateYmd,
    start_hm: startHm,
    end_hm: endHm,
    starts_at: startsAt,
    ends_at: endsAt,
    label: args.label == null ? null : String(args.label),
    note: args.note == null ? null : String(args.note),
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "upsert_staff_shift",
      message:
        locale === "de"
          ? `Schicht ${found.label} ${dateYmd} ${startHm}–${endHm}`
          : `Shift ${found.label} ${dateYmd} ${startHm}–${endHm}`,
      preview,
    });
  }

  if (shiftId) {
    const { error } = await target.sb
      .from("restaurant_staff_scheduled_shifts")
      .update({
        staff_id: found.id,
        starts_at: startsAt,
        ends_at: endsAt,
        label: preview.label,
        note: preview.note,
      })
      .eq("id", shiftId)
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
  } else {
    const { error } = await target.sb
      .from("restaurant_staff_scheduled_shifts")
      .insert({
        restaurant_id: target.restaurantId,
        staff_id: found.id,
        starts_at: startsAt,
        ends_at: endsAt,
        label: preview.label,
        note: preview.note,
        status: "confirmed",
        created_by: ctx.userId,
      });
    if (error) return assistantJson({ ok: false, error: error.message });
  }
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Schicht für ${found.label} gespeichert.`
        : `Shift for ${found.label} saved.`,
  });
}

export async function applyUpsertStaffShiftPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpsertStaffShift(ctx, { ...preview, confirm: true }, locale);
}

export async function toolDeleteStaffShift(
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
    "staff",
    "update",
    "Keine Berechtigung für den Schichtplan.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  let shiftId = typeof args.shift_id === "string" ? args.shift_id.trim() : "";
  let label = String(args.name ?? args.staff_name ?? "").trim();
  if (!shiftId) {
    const found = await resolveStaffMember(
      target.sb,
      target.restaurantId,
      args,
      locale,
    );
    if (!found.ok) {
      return assistantJson({ ok: false, ask: found.ask, error: found.error });
    }
    label = found.label;
    const dateYmd = String(args.date_ymd ?? "").trim();
    const timeZone = await fetchRestaurantTimezoneServer(
      target.sb,
      target.restaurantId,
    );
    const day =
      dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd)
        ? dateYmd
        : restaurantTodayYmd(timeZone);
    const startIso = ymdHmToRestaurantIso(day, "00:00", timeZone);
    const endIso = ymdHmToRestaurantIso(
      restaurantIsoToYmdHm(
        new Date(new Date(startIso).getTime() + 86400000).toISOString(),
        timeZone,
      ).ymd,
      "00:00",
      timeZone,
    );
    const { data, error } = await target.sb
      .from("restaurant_staff_scheduled_shifts")
      .select("id, starts_at, ends_at")
      .eq("restaurant_id", target.restaurantId)
      .eq("staff_id", found.id)
      .gte("starts_at", startIso)
      .lt("starts_at", endIso)
      .limit(6);
    if (error) return assistantJson({ ok: false, error: error.message });
    const rows = data ?? [];
    if (rows.length !== 1) {
      return assistantJson({
        ok: false,
        ask:
          locale === "de"
            ? "Welche Schicht (shift_id) soll gelöscht werden?"
            : "Which shift_id should be deleted?",
      });
    }
    shiftId = rows[0]!.id as string;
  }

  const preview = { shift_id: shiftId, staff_name: label };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "delete_staff_shift",
      message:
        locale === "de"
          ? `Schicht ${label || shiftId} löschen`
          : `Delete shift ${label || shiftId}`,
      preview,
    });
  }
  const { error } = await target.sb
    .from("restaurant_staff_scheduled_shifts")
    .delete()
    .eq("id", shiftId)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message: locale === "de" ? "Schicht gelöscht." : "Shift deleted.",
  });
}

export async function applyDeleteStaffShiftPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolDeleteStaffShift(ctx, { ...preview, confirm: true }, locale);
}

/* ─── todos / docs / guides / compliance / menu meta / accounting / settings ── */

export async function toolListStaffTodos(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "staff_todos",
    "read",
    "Keine Berechtigung für Checklisten.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const { data, error } = await target.sb
    .from("restaurant_staff_todos")
    .select("id, title, priority, display_from, display_until")
    .eq("restaurant_id", target.restaurantId)
    .order("sort_order", { ascending: true })
    .limit(ASSISTANT_LIST_CAP);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    todos: (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
    })),
  });
}

export async function toolUpsertStaffTodo(
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
    "staff_todos",
    "create",
    "Keine Berechtigung für Checklisten.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const title = String(args.title ?? "").trim();
  if (!title) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Welcher ToDo-Titel?" : "What todo title?",
    });
  }
  const preview = {
    todo_id: typeof args.todo_id === "string" ? args.todo_id : null,
    title,
    description: args.description == null ? null : String(args.description),
    priority: String(args.priority ?? "normal"),
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "upsert_staff_todo",
      message:
        locale === "de" ? `ToDo „${title}“ speichern` : `Save todo “${title}”`,
      preview,
    });
  }
  if (preview.todo_id) {
    const { error } = await target.sb
      .from("restaurant_staff_todos")
      .update({
        title,
        description: preview.description,
        priority: preview.priority,
      })
      .eq("id", preview.todo_id)
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
  } else {
    const { error } = await target.sb.from("restaurant_staff_todos").insert({
      restaurant_id: target.restaurantId,
      title,
      description: preview.description,
      priority: preview.priority,
      assignee_type: "all",
      created_by: ctx.userId,
      show_on_display: true,
      completion_mode: "any_one",
      capture_type: "boolean",
    });
    if (error) return assistantJson({ ok: false, error: error.message });
  }
  return assistantJson({
    ok: true,
    status: "saved",
    message: locale === "de" ? "ToDo gespeichert." : "Todo saved.",
  });
}

export async function applyUpsertStaffTodoPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpsertStaffTodo(ctx, { ...preview, confirm: true }, locale);
}

export async function toolListDocuments(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "documents",
    "read",
    "Keine Berechtigung für Dokumente.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const q = String(args.query ?? args.name ?? "").trim();
  let query = target.sb
    .from("restaurant_documents")
    .select("id, title, created_at")
    .eq("restaurant_id", target.restaurantId)
    .order("created_at", { ascending: false })
    .limit(ASSISTANT_LIST_CAP);
  if (q) query = query.ilike("title", `%${q.replace(/[%_,]/g, "")}%`);
  const { data, error } = await query;
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    documents: (data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      created_at: d.created_at,
    })),
  });
}

export async function toolAddDocumentNote(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessPermission(
    ctx,
    target.restaurantId,
    "documents.notes.edit",
    "Keine Berechtigung für Dokument-Notizen.",
  );
  if (denied) {
    const fallback = await denyUnlessModuleCrud(
      ctx,
      target.restaurantId,
      "documents",
      "update",
      "Keine Berechtigung für Dokument-Notizen.",
    );
    if (fallback) return assistantJson({ ok: false, error: fallback });
  }
  const documentId = String(args.document_id ?? "").trim();
  const body = String(args.body ?? args.note ?? "").trim();
  if (!documentId || !body) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Dokument-ID und Notiztext?"
          : "Document id and note text?",
    });
  }
  const preview = { document_id: documentId, body };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "add_document_note",
      message:
        locale === "de"
          ? `Notiz am Dokument speichern`
          : `Save document note`,
      preview,
    });
  }
  const employeeId = await resolveRestaurantEmployeeId(
    target.sb,
    target.restaurantId,
    ctx.userId,
  );
  const { error } = await target.sb.from("restaurant_document_note_entries").insert({
    restaurant_id: target.restaurantId,
    document_id: documentId,
    employee_id: employeeId,
    actor_user_id: ctx.userId,
    body,
  });
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message: locale === "de" ? "Notiz gespeichert." : "Note saved.",
  });
}

export async function applyAddDocumentNotePreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolAddDocumentNote(ctx, { ...preview, confirm: true }, locale);
}

export async function toolListGuides(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "guides",
    "read",
    "Keine Berechtigung für Anleitungen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const q = String(args.query ?? args.name ?? "").trim();
  let query = target.sb
    .from("restaurant_guides")
    .select("id, title, updated_at")
    .eq("restaurant_id", target.restaurantId)
    .order("title")
    .limit(ASSISTANT_LIST_CAP);
  if (q) query = query.ilike("title", `%${q.replace(/[%_,]/g, "")}%`);
  const { data, error } = await query;
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    guides: (data ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      updated_at: g.updated_at,
    })),
  });
}

export async function toolListCompliance(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "compliance",
    "read",
    "Keine Berechtigung für Eigenkontrollen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const { data, error } = await target.sb
    .from("restaurant_compliance_checklists")
    .select("id, name, category, is_active, priority")
    .eq("restaurant_id", target.restaurantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(ASSISTANT_LIST_CAP);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    checklists: data ?? [],
  });
}

export async function toolCreateComplianceRecord(
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
    "compliance",
    "create",
    "Keine Berechtigung für Eigenkontrollen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const title = String(args.title ?? args.name ?? "").trim();
  if (!title) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Name der Eigenkontroll-Checkliste?"
          : "Compliance checklist name?",
    });
  }
  const preview = {
    title,
    description: args.note == null && args.description == null
      ? null
      : String(args.note ?? args.description),
    category: String(args.category ?? "other"),
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "create_compliance_record",
      message:
        locale === "de"
          ? `Checkliste „${title}“ anlegen`
          : `Create checklist “${title}”`,
      preview,
    });
  }
  const { error } = await target.sb.from("restaurant_compliance_checklists").insert({
    restaurant_id: target.restaurantId,
    name: title,
    description: preview.description,
    category: preview.category,
    frequency: "daily",
    items: [],
    show_on_display: true,
    is_active: true,
    sort_order: 0,
    assignee_type: "all",
    priority: "medium",
  });
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? "Checkliste gespeichert."
        : "Checklist saved.",
  });
}

export async function applyCreateComplianceRecordPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolCreateComplianceRecord(ctx, { ...preview, confirm: true }, locale);
}

export async function toolDeleteMenuItem(
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
    "menu",
    "delete",
    "Keine Berechtigung, Gerichte zu löschen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const name = String(args.name ?? "").trim();
  const menuItemId =
    typeof args.menu_item_id === "string" ? args.menu_item_id.trim() : "";
  let id = menuItemId;
  let label = name;
  if (!id) {
    if (!name) return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
    const q = name.replace(/[%_,]/g, "");
    const { data, error } = await target.sb
      .from("menu_items")
      .select("id, name")
      .eq("restaurant_id", target.restaurantId)
      .ilike("name", `%${q}%`)
      .limit(6);
    if (error) return assistantJson({ ok: false, error: error.message });
    const rows = data ?? [];
    if (rows.length !== 1) {
      return assistantJson({
        ok: false,
        ask:
          rows.length === 0
            ? assistantAsk(locale, "dish")
            : assistantAskWhich(
                locale,
                "which",
                rows.map((r) => String(r.name)),
              ),
      });
    }
    id = rows[0]!.id as string;
    label = String(rows[0]!.name);
  }
  const preview = { menu_item_id: id, name: label };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "delete_menu_item",
      message:
        locale === "de"
          ? `Gericht ${label} löschen`
          : `Delete dish ${label}`,
      preview,
    });
  }
  const { error } = await target.sb
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Gericht ${label} gelöscht.`
        : `Dish ${label} deleted.`,
  });
}

export async function applyDeleteMenuItemPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolDeleteMenuItem(ctx, { ...preview, confirm: true }, locale);
}

export async function toolUpsertMenuCategory(
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
    "menu",
    "create",
    "Keine Berechtigung für Kategorien.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const name = String(args.name ?? "").trim();
  if (!name) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Kategoriename?" : "Category name?",
    });
  }
  const preview = {
    name,
    category_id: typeof args.category_id === "string" ? args.category_id : null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "upsert_menu_category",
      message:
        locale === "de"
          ? `Kategorie „${name}“ speichern`
          : `Save category “${name}”`,
      preview,
    });
  }
  if (preview.category_id) {
    const { error } = await target.sb
      .from("menu_categories")
      .update({ name })
      .eq("id", preview.category_id)
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
  } else {
    const { error } = await target.sb.from("menu_categories").insert({
      restaurant_id: target.restaurantId,
      name,
    });
    if (error) return assistantJson({ ok: false, error: error.message });
  }
  return assistantJson({
    ok: true,
    status: "saved",
    message: locale === "de" ? "Kategorie gespeichert." : "Category saved.",
  });
}

export async function applyUpsertMenuCategoryPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpsertMenuCategory(ctx, { ...preview, confirm: true }, locale);
}

export async function toolUpsertMenuTag(
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
    "menu",
    "create",
    "Keine Berechtigung für Tags.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });
  const name = String(args.name ?? "").trim();
  const kind = String(args.kind ?? "tag").toLowerCase() === "allergen"
    ? "allergen"
    : "tag";
  if (!name) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Tag-/Allergen-Name?" : "Tag/allergen name?",
    });
  }
  const table = kind === "allergen" ? "menu_allergens" : "menu_tags";
  const action =
    kind === "allergen" ? "upsert_menu_allergen" : "upsert_menu_tag";
  const preview = { name, kind };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action,
      message:
        locale === "de"
          ? `${kind === "allergen" ? "Allergen" : "Tag"} „${name}“ anlegen`
          : `Create ${kind} “${name}”`,
      preview,
    });
  }
  const { error } = await target.sb.from(table).insert({
    restaurant_id: target.restaurantId,
    name,
  });
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `${kind === "allergen" ? "Allergen" : "Tag"} gespeichert.`
        : `${kind} saved.`,
  });
}

export async function applyUpsertMenuTagPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpsertMenuTag(ctx, { ...preview, confirm: true }, locale);
}

export async function toolCreateCashBookEntry(
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
    "accounting",
    "create",
    "Keine Berechtigung fürs Kassenbuch.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const direction =
    String(args.direction ?? "expense").toLowerCase() === "income"
      ? "income"
      : "expense";
  const amount = Number(args.amount);
  const note = String(args.note ?? args.body ?? "").trim();
  const categoryName = String(args.category ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Welcher Betrag?" : "What amount?",
    });
  }

  await ensureAccountingCashBookDefaults(target.sb, target.restaurantId);
  const cats = await listAccountingCashCategories(
    target.sb,
    target.restaurantId,
    direction,
  );
  let category = cats[0] ?? null;
  if (categoryName) {
    const q = categoryName.toLowerCase();
    category =
      cats.find((c) => c.name.toLowerCase().includes(q)) ?? category;
  }
  if (!category) {
    return assistantJson({
      ok: false,
      error: "Keine Kassenbuch-Kategorie gefunden.",
    });
  }

  const timeZone = await fetchRestaurantTimezoneServer(
    target.sb,
    target.restaurantId,
  );
  const entryDate =
    typeof args.date_ymd === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(args.date_ymd)
      ? args.date_ymd
      : restaurantTodayYmd(timeZone);

  const preview = {
    direction,
    amount,
    note,
    category_id: category.id,
    category_name: category.name,
    date_ymd: entryDate,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "create_cash_book_entry",
      message:
        locale === "de"
          ? `Kassenbuch ${direction === "income" ? "Einnahme" : "Ausgabe"} ${amount} € (${category.name})`
          : `Cash book ${direction} ${amount} (${category.name})`,
      preview,
    });
  }

  const result = await upsertAccountingCashEntry(target.sb, target.restaurantId, {
    entry_date: entryDate,
    direction,
    category_id: category.id,
    note,
    tax_lines: [{ tax_rate_percent: 19, amount }],
  });
  if (result.error || !result.row) {
    return assistantJson({
      ok: false,
      error: result.error ?? "Kassenbuch-Eintrag fehlgeschlagen.",
    });
  }
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? "Kassenbuch-Eintrag gespeichert."
        : "Cash book entry saved.",
  });
}

export async function applyCreateCashBookEntryPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolCreateCashBookEntry(ctx, { ...preview, confirm: true }, locale);
}

export async function toolUpdateRestaurantStammdaten(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessPermission(
    ctx,
    target.restaurantId,
    "settings.restaurant",
    "Keine Berechtigung für Stammdaten.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const patch: Record<string, unknown> = {};
  if (args.name != null) patch.name = String(args.name).trim();
  if (args.phone != null) patch.phone = String(args.phone).trim() || null;
  if (args.website != null) patch.website = String(args.website).trim() || null;
  if (args.street != null || args.address_line1 != null) {
    patch.address_line1 = String(args.street ?? args.address_line1)
      .trim() || null;
  }
  if (args.city != null) patch.city = String(args.city).trim() || null;
  if (args.postal_code != null) {
    patch.postal_code = String(args.postal_code).trim() || null;
  }
  if (Object.keys(patch).length === 0) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welche Stammdaten sollen geändert werden (name, phone, website, street, city)?"
          : "Which fields (name, phone, website, street, city)?",
    });
  }
  const preview = { patch };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "update_restaurant_stammdaten",
      message:
        locale === "de"
          ? `Stammdaten ändern: ${Object.keys(patch).join(", ")}`
          : `Update restaurant fields: ${Object.keys(patch).join(", ")}`,
      preview,
    });
  }
  const { error } = await target.sb
    .from("restaurants")
    .update(patch)
    .eq("id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? "Stammdaten gespeichert."
        : "Restaurant details saved.",
  });
}

export async function applyUpdateRestaurantStammdatenPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpdateRestaurantStammdaten(
    ctx,
    {
      ...(typeof preview.patch === "object" && preview.patch
        ? (preview.patch as Record<string, unknown>)
        : preview),
      confirm: true,
    },
    locale,
  );
}

/** Confirm-route registry for full-ops mutations. */
export const FULL_OPS_CONFIRM_APPLIERS: Record<
  string,
  (
    ctx: AssistantToolContext,
    preview: Record<string, unknown>,
    locale: AppLocale,
  ) => Promise<string>
> = {
  upsert_contact: applyUpsertContactPreview,
  delete_contact: applyDeleteContactPreview,
  mark_contact_thread_read: applyMarkContactThreadReadPreview,
  reply_to_review: applyReplyToReviewPreview,
  mark_review_read: applyMarkReviewReadPreview,
  upsert_news_post: applyUpsertNewsPostPreview,
  upsert_event: applyUpsertEventPreview,
  upsert_ingredient: applyUpsertIngredientPreview,
  create_purchase_order: applyCreatePurchaseOrderPreview,
  create_staff: applyCreateStaffPreview,
  delete_staff: applyDeleteStaffPreview,
  upsert_staff_shift: applyUpsertStaffShiftPreview,
  delete_staff_shift: applyDeleteStaffShiftPreview,
  upsert_staff_todo: applyUpsertStaffTodoPreview,
  add_document_note: applyAddDocumentNotePreview,
  create_compliance_record: applyCreateComplianceRecordPreview,
  delete_menu_item: applyDeleteMenuItemPreview,
  upsert_menu_category: applyUpsertMenuCategoryPreview,
  upsert_menu_tag: applyUpsertMenuTagPreview,
  upsert_menu_allergen: applyUpsertMenuTagPreview,
  create_cash_book_entry: applyCreateCashBookEntryPreview,
  update_restaurant_stammdaten: applyUpdateRestaurantStammdatenPreview,
};
