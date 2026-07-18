import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAppLocale } from "@/i18n/config";
import { PLATFORM_NEWSLETTER_STORAGE_BUCKET } from "@/lib/newsletter/newsletter-constants";
import type {
  PlatformNewsletter,
  PlatformNewsletterBlock,
  PlatformNewsletterDetail,
  PlatformNewsletterStatus,
} from "@/lib/types/platform-newsletter";

function publicStorageUrl(
  supabaseUrl: string | undefined,
  path: string | null | undefined,
): string | null {
  if (!path?.trim() || !supabaseUrl) return null;
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PLATFORM_NEWSLETTER_STORAGE_BUCKET}/${path.replace(/^\//, "")}`;
}

function mapBlock(
  row: Record<string, unknown>,
  supabaseUrl?: string,
): PlatformNewsletterBlock {
  const imagePath =
    typeof row.image_path === "string" ? row.image_path : null;
  return {
    id: String(row.id),
    newsletterId: String(row.newsletter_id),
    sortOrder: Number(row.sort_order ?? 0),
    heading: typeof row.heading === "string" ? row.heading : "",
    body: typeof row.body === "string" ? row.body : "",
    imagePath,
    imageAlt: typeof row.image_alt === "string" ? row.image_alt : null,
    imageUrl: publicStorageUrl(supabaseUrl, imagePath),
  };
}

function mapNewsletter(
  row: Record<string, unknown>,
  extras?: Partial<PlatformNewsletter>,
): PlatformNewsletter {
  const status = String(row.status ?? "draft") as PlatformNewsletterStatus;
  return {
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "",
    subject: typeof row.subject === "string" ? row.subject : "",
    preheader: typeof row.preheader === "string" ? row.preheader : null,
    status,
    scheduledAt:
      typeof row.scheduled_at === "string" ? row.scheduled_at : null,
    startedAt: typeof row.started_at === "string" ? row.started_at : null,
    sentAt: typeof row.sent_at === "string" ? row.sent_at : null,
    isTemplate: Boolean(row.is_template),
    sourceNewsletterId:
      typeof row.source_newsletter_id === "string"
        ? row.source_newsletter_id
        : null,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    blockCount: extras?.blockCount ?? 0,
    outboxPending: extras?.outboxPending ?? 0,
    outboxSent: extras?.outboxSent ?? 0,
    outboxFailed: extras?.outboxFailed ?? 0,
  };
}

export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listPlatformNewsletters(
  admin: SupabaseClient,
  opts?: { templatesOnly?: boolean },
): Promise<PlatformNewsletter[]> {
  let q = admin
    .from("platform_newsletters")
    .select("*")
    .order("updated_at", { ascending: false });
  if (opts?.templatesOnly) {
    q = q.eq("is_template", true);
  } else {
    q = q.eq("is_template", false);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => String(r.id));
  const [{ data: blocks }, { data: outbox }] = await Promise.all([
    admin
      .from("platform_newsletter_blocks")
      .select("newsletter_id")
      .in("newsletter_id", ids),
    admin
      .from("platform_newsletter_outbox")
      .select("newsletter_id, status")
      .in("newsletter_id", ids),
  ]);

  const blockCounts = new Map<string, number>();
  for (const b of blocks ?? []) {
    const id = String((b as { newsletter_id: string }).newsletter_id);
    blockCounts.set(id, (blockCounts.get(id) ?? 0) + 1);
  }
  const pending = new Map<string, number>();
  const sent = new Map<string, number>();
  const failed = new Map<string, number>();
  for (const o of outbox ?? []) {
    const row = o as { newsletter_id: string; status: string };
    const id = String(row.newsletter_id);
    if (row.status === "pending") pending.set(id, (pending.get(id) ?? 0) + 1);
    else if (row.status === "sent") sent.set(id, (sent.get(id) ?? 0) + 1);
    else if (row.status === "failed") failed.set(id, (failed.get(id) ?? 0) + 1);
  }

  return rows.map((row) => {
    const id = String(row.id);
    return mapNewsletter(row, {
      blockCount: blockCounts.get(id) ?? 0,
      outboxPending: pending.get(id) ?? 0,
      outboxSent: sent.get(id) ?? 0,
      outboxFailed: failed.get(id) ?? 0,
    });
  });
}

export async function getPlatformNewsletterDetail(
  admin: SupabaseClient,
  id: string,
  supabaseUrl?: string,
): Promise<PlatformNewsletterDetail | null> {
  const { data, error } = await admin
    .from("platform_newsletters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: blockRows, error: blockErr } = await admin
    .from("platform_newsletter_blocks")
    .select("*")
    .eq("newsletter_id", id)
    .order("sort_order", { ascending: true });
  if (blockErr) throw new Error(blockErr.message);

  const blocks = ((blockRows ?? []) as Record<string, unknown>[]).map((r) =>
    mapBlock(r, supabaseUrl),
  );

  const { data: outbox } = await admin
    .from("platform_newsletter_outbox")
    .select("status")
    .eq("newsletter_id", id);

  let outboxPending = 0;
  let outboxSent = 0;
  let outboxFailed = 0;
  for (const o of outbox ?? []) {
    const status = String((o as { status: string }).status);
    if (status === "pending") outboxPending += 1;
    else if (status === "sent") outboxSent += 1;
    else if (status === "failed") outboxFailed += 1;
  }

  return {
    ...mapNewsletter(data as Record<string, unknown>, {
      blockCount: blocks.length,
      outboxPending,
      outboxSent,
      outboxFailed,
    }),
    blocks,
  };
}

export type NewsletterBlockInput = {
  id?: string;
  heading: string;
  body: string;
  imagePath?: string | null;
  imageAlt?: string | null;
};

export async function createPlatformNewsletter(
  admin: SupabaseClient,
  input: {
    title: string;
    subject?: string;
    preheader?: string | null;
    isTemplate?: boolean;
    sourceNewsletterId?: string | null;
    createdBy?: string | null;
    blocks?: NewsletterBlockInput[];
  },
): Promise<string> {
  const { data, error } = await admin
    .from("platform_newsletters")
    .insert({
      title: input.title.trim() || "Neuer Newsletter",
      subject: input.subject?.trim() ?? "",
      preheader: input.preheader?.trim() || null,
      is_template: Boolean(input.isTemplate),
      source_newsletter_id: input.sourceNewsletterId ?? null,
      created_by: input.createdBy ?? null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = String(data.id);

  if (input.blocks?.length) {
    const rows = input.blocks.map((b, i) => ({
      newsletter_id: id,
      sort_order: i,
      heading: b.heading,
      body: b.body,
      image_path: b.imagePath ?? null,
      image_alt: b.imageAlt ?? null,
    }));
    const { error: bErr } = await admin
      .from("platform_newsletter_blocks")
      .insert(rows);
    if (bErr) throw new Error(bErr.message);
  }

  return id;
}

export async function updatePlatformNewsletter(
  admin: SupabaseClient,
  id: string,
  input: {
    title?: string;
    subject?: string;
    preheader?: string | null;
    status?: PlatformNewsletterStatus;
    scheduledAt?: string | null;
    isTemplate?: boolean;
    blocks?: NewsletterBlockInput[];
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.subject !== undefined) patch.subject = input.subject.trim();
  if (input.preheader !== undefined) {
    patch.preheader = input.preheader?.trim() || null;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.scheduledAt !== undefined) patch.scheduled_at = input.scheduledAt;
  if (input.isTemplate !== undefined) patch.is_template = input.isTemplate;

  const { error } = await admin
    .from("platform_newsletters")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (input.blocks) {
    const { error: delErr } = await admin
      .from("platform_newsletter_blocks")
      .delete()
      .eq("newsletter_id", id);
    if (delErr) throw new Error(delErr.message);
    if (input.blocks.length > 0) {
      const rows = input.blocks.map((b, i) => ({
        newsletter_id: id,
        sort_order: i,
        heading: b.heading,
        body: b.body,
        image_path: b.imagePath ?? null,
        image_alt: b.imageAlt ?? null,
      }));
      const { error: insErr } = await admin
        .from("platform_newsletter_blocks")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    // Invalidate cached translations when content changes
    await admin
      .from("platform_newsletter_translations")
      .delete()
      .eq("newsletter_id", id);
  }
}

export async function deletePlatformNewsletter(
  admin: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await admin
    .from("platform_newsletters")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function duplicatePlatformNewsletter(
  admin: SupabaseClient,
  sourceId: string,
  opts: {
    asTemplate?: boolean;
    createdBy?: string | null;
    titleSuffix?: string;
  },
): Promise<string> {
  const detail = await getPlatformNewsletterDetail(admin, sourceId);
  if (!detail) throw new Error("newsletter_not_found");
  const suffix = opts.titleSuffix ?? (opts.asTemplate ? " (Vorlage)" : " (Kopie)");
  return createPlatformNewsletter(admin, {
    title: `${detail.title}${suffix}`,
    subject: detail.subject,
    preheader: detail.preheader,
    isTemplate: Boolean(opts.asTemplate),
    sourceNewsletterId: sourceId,
    createdBy: opts.createdBy,
    blocks: detail.blocks.map((b) => ({
      heading: b.heading,
      body: b.body,
      imagePath: b.imagePath,
      imageAlt: b.imageAlt,
    })),
  });
}

export async function countOptedInSubscribers(
  admin: SupabaseClient,
): Promise<number> {
  const { count, error } = await admin
    .from("platform_newsletter_subscribers")
    .select("id", { count: "exact", head: true })
    .eq("opted_in", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function upsertNewsletterSubscriber(params: {
  admin: SupabaseClient;
  email: string;
  profileId?: string | null;
  locale?: string | null;
  optedIn: boolean;
}): Promise<{ id: string; unsubscribeToken: string }> {
  const email = params.email.trim();
  const emailNormalized = normalizeNewsletterEmail(email);
  if (!emailNormalized.includes("@")) {
    throw new Error("invalid_email");
  }
  const locale = normalizeAppLocale(params.locale);
  const now = new Date().toISOString();

  const { data: existing } = await params.admin
    .from("platform_newsletter_subscribers")
    .select("id, unsubscribe_token")
    .eq("email_normalized", emailNormalized)
    .maybeSingle();

  if (existing) {
    const { data, error } = await params.admin
      .from("platform_newsletter_subscribers")
      .update({
        email,
        profile_id: params.profileId ?? undefined,
        locale,
        opted_in: params.optedIn,
        opted_in_at: params.optedIn ? now : undefined,
        opted_out_at: params.optedIn ? null : now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("id, unsubscribe_token")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: String(data.id),
      unsubscribeToken: String(data.unsubscribe_token),
    };
  }

  const { data, error } = await params.admin
    .from("platform_newsletter_subscribers")
    .insert({
      email,
      email_normalized: emailNormalized,
      profile_id: params.profileId ?? null,
      locale,
      opted_in: params.optedIn,
      opted_in_at: params.optedIn ? now : null,
      opted_out_at: params.optedIn ? null : now,
    })
    .select("id, unsubscribe_token")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: String(data.id),
    unsubscribeToken: String(data.unsubscribe_token),
  };
}

export async function setProfileNewsletterSubscribed(
  admin: SupabaseClient,
  profileId: string,
  subscribed: boolean,
): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ newsletter_subscribed: subscribed })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function getSubscriberByUnsubscribeToken(
  admin: SupabaseClient,
  token: string,
): Promise<{
  id: string;
  email: string;
  optedIn: boolean;
  profileId: string | null;
} | null> {
  const { data, error } = await admin
    .from("platform_newsletter_subscribers")
    .select("id, email, opted_in, profile_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: String(data.id),
    email: String(data.email),
    optedIn: Boolean(data.opted_in),
    profileId: typeof data.profile_id === "string" ? data.profile_id : null,
  };
}
