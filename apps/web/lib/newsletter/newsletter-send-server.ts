import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAppLocale, type AppLocale } from "@/i18n/config";
import {
  buildNewsletterEmailHtml,
  buildNewsletterEmailText,
  type NewsletterEmailBlock,
} from "@/lib/email/newsletter-email-layout";
import { fetchTransactionalEmailBranding } from "@/lib/email/fetch-transactional-email-branding";
import { sendViaSmtp } from "@/lib/email/send-via-smtp";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import {
  PLATFORM_NEWSLETTER_BATCH_SIZE,
  PLATFORM_NEWSLETTER_FROM_NAME,
  PLATFORM_NEWSLETTER_SEND_GAP_MS,
  PLATFORM_NEWSLETTER_SOURCE_LOCALE,
  PLATFORM_NEWSLETTER_STORAGE_BUCKET,
} from "@/lib/newsletter/newsletter-constants";
import { translateNewsletterTexts } from "@/lib/newsletter/newsletter-translate-server";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { getPlatformNewsletterDetail } from "@/lib/supabase/platform-newsletter-db";
import { GWADA_PRODUCTION_ORIGIN } from "@/lib/constants/gwada-domains";
import { getPublicSiteUrl } from "@/lib/public-env";

function resolveNewsletterOrigin(override?: string): string {
  return (
    override?.replace(/\/$/, "") ||
    getPublicSiteUrl()?.replace(/\/$/, "") ||
    GWADA_PRODUCTION_ORIGIN
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicImageUrl(
  supabaseUrl: string,
  path: string | null | undefined,
): string | null {
  if (!path?.trim()) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${PLATFORM_NEWSLETTER_STORAGE_BUCKET}/${path.replace(/^\//, "")}`;
}

type LocalizedContent = {
  subject: string;
  preheader: string | null;
  blocks: NewsletterEmailBlock[];
  lang: AppLocale;
};

async function loadOrBuildLocalizedContent(params: {
  admin: SupabaseClient;
  newsletterId: string;
  locale: string;
  supabaseUrl: string;
}): Promise<LocalizedContent | null> {
  const detail = await getPlatformNewsletterDetail(
    params.admin,
    params.newsletterId,
    params.supabaseUrl,
  );
  if (!detail) return null;

  const locale = normalizeAppLocale(params.locale);
  if (locale === PLATFORM_NEWSLETTER_SOURCE_LOCALE) {
    return {
      subject: detail.subject,
      preheader: detail.preheader,
      lang: locale,
      blocks: detail.blocks.map((b) => ({
        heading: b.heading,
        body: b.body,
        imageUrl: b.imageUrl ?? publicImageUrl(params.supabaseUrl, b.imagePath),
        imageAlt: b.imageAlt,
      })),
    };
  }

  const { data: cached } = await params.admin
    .from("platform_newsletter_translations")
    .select("subject, preheader, blocks_json")
    .eq("newsletter_id", params.newsletterId)
    .eq("locale", locale)
    .maybeSingle();

  if (cached) {
    const blocksJson = Array.isArray(cached.blocks_json)
      ? (cached.blocks_json as Array<Record<string, unknown>>)
      : [];
    return {
      subject: String(cached.subject),
      preheader:
        typeof cached.preheader === "string" ? cached.preheader : null,
      lang: locale,
      blocks: detail.blocks.map((b, i) => {
        const t = blocksJson[i];
        return {
          heading:
            typeof t?.heading === "string" ? t.heading : b.heading,
          body: typeof t?.body === "string" ? t.body : b.body,
          imageUrl:
            b.imageUrl ?? publicImageUrl(params.supabaseUrl, b.imagePath),
          imageAlt: b.imageAlt,
        };
      }),
    };
  }

  const texts: string[] = [
    detail.subject,
    detail.preheader ?? "",
    ...detail.blocks.flatMap((b) => [b.heading, b.body]),
  ];
  const translated = await translateNewsletterTexts({
    texts,
    targetLocale: locale,
  });

  const subject = translated[0] ?? detail.subject;
  const preheader = (translated[1] ?? detail.preheader ?? "").trim() || null;
  const blocks: NewsletterEmailBlock[] = detail.blocks.map((b, i) => {
    const base = 2 + i * 2;
    return {
      heading: translated[base] ?? b.heading,
      body: translated[base + 1] ?? b.body,
      imageUrl: b.imageUrl ?? publicImageUrl(params.supabaseUrl, b.imagePath),
      imageAlt: b.imageAlt,
    };
  });

  await params.admin.from("platform_newsletter_translations").upsert({
    newsletter_id: params.newsletterId,
    locale,
    subject,
    preheader,
    blocks_json: blocks.map((b) => ({
      heading: b.heading,
      body: b.body,
    })),
  });

  return { subject, preheader, blocks, lang: locale };
}

function unsubscribeLabels(locale: AppLocale): {
  label: string;
  footer: string;
} {
  if (locale === "de") {
    return {
      label: "Vom Newsletter abmelden",
      footer: "Du erhältst diese E-Mail, weil du den Gwada-Newsletter abonniert hast.",
    };
  }
  return {
    label: "Unsubscribe from newsletter",
    footer: "You receive this email because you subscribed to the Gwada newsletter.",
  };
}

export async function enqueueNewsletterSend(params: {
  admin: SupabaseClient;
  newsletterId: string;
  sendAt?: Date;
}): Promise<{ recipientCount: number }> {
  const detail = await getPlatformNewsletterDetail(
    params.admin,
    params.newsletterId,
  );
  if (!detail) throw new Error("newsletter_not_found");
  if (detail.isTemplate) throw new Error("template_cannot_send");
  if (!detail.subject.trim()) throw new Error("subject_required");
  if (detail.blocks.length === 0) throw new Error("blocks_required");
  if (detail.status === "sending" || detail.status === "sent") {
    throw new Error("already_sending_or_sent");
  }

  const { data: subscribers, error } = await params.admin
    .from("platform_newsletter_subscribers")
    .select("id, email, locale")
    .eq("opted_in", true);
  if (error) throw new Error(error.message);
  if (!subscribers?.length) throw new Error("no_subscribers");

  const sendAt = (params.sendAt ?? new Date()).toISOString();
  const rows = subscribers.map((s) => ({
    newsletter_id: params.newsletterId,
    subscriber_id: String(s.id),
    email: String(s.email),
    locale: normalizeAppLocale(
      typeof s.locale === "string" ? s.locale : "de",
    ),
    status: "pending",
    send_at: sendAt,
    attempts: 0,
    last_error: null,
    sent_at: null,
  }));

  await params.admin
    .from("platform_newsletter_outbox")
    .delete()
    .eq("newsletter_id", params.newsletterId);

  const { error: insErr } = await params.admin
    .from("platform_newsletter_outbox")
    .insert(rows);
  if (insErr) throw new Error(insErr.message);

  const now = new Date().toISOString();
  const scheduledInFuture =
    params.sendAt != null && params.sendAt.getTime() > Date.now() + 5_000;

  const { error: updErr } = await params.admin
    .from("platform_newsletters")
    .update({
      status: scheduledInFuture ? "scheduled" : "sending",
      scheduled_at: sendAt,
      started_at: scheduledInFuture ? null : now,
      updated_at: now,
    })
    .eq("id", params.newsletterId);
  if (updErr) throw new Error(updErr.message);

  return { recipientCount: rows.length };
}

export async function sendNewsletterTestEmail(params: {
  admin: SupabaseClient;
  newsletterId: string;
  toEmail: string;
  locale?: string;
  supabaseUrl: string;
  origin?: string;
}): Promise<void> {
  const to = params.toEmail.trim().toLowerCase();
  if (!to.includes("@")) throw new Error("invalid_email");

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) throw new Error("smtp_not_configured");
  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) throw new Error("smtp_incomplete");

  const localized = await loadOrBuildLocalizedContent({
    admin: params.admin,
    newsletterId: params.newsletterId,
    locale: params.locale ?? "de",
    supabaseUrl: params.supabaseUrl,
  });
  if (!localized) throw new Error("newsletter_not_found");

  const branding = await fetchTransactionalEmailBranding(params.admin);
  const origin = resolveNewsletterOrigin(params.origin);
  const labels = unsubscribeLabels(localized.lang);
  const unsubscribeUrl = `${origin}/newsletter/abmelden/preview`;

  const html = buildNewsletterEmailHtml({
    brandName: branding.appName || PLATFORM_NEWSLETTER_FROM_NAME,
    logoUrl: branding.logoUrl,
    subject: localized.subject,
    preheader: localized.preheader,
    blocks: localized.blocks,
    unsubscribeUrl,
    unsubscribeLabel: labels.label,
    footerNote: `${labels.footer} (Testmail)`,
    lang: localized.lang,
  });
  const text = buildNewsletterEmailText({
    brandName: branding.appName || PLATFORM_NEWSLETTER_FROM_NAME,
    subject: localized.subject,
    blocks: localized.blocks,
    unsubscribeUrl,
    unsubscribeLabel: labels.label,
    lang: localized.lang,
  });

  const result = await sendViaSmtp(smtp, {
    to,
    subject: `[Test] ${localized.subject}`,
    text,
    html,
    fromName:
      platformEmail.config.from_name?.trim() || PLATFORM_NEWSLETTER_FROM_NAME,
  });
  if (!result.ok) throw new Error(result.error);
}

export async function processNewsletterOutbox(params: {
  admin: SupabaseClient;
  supabaseUrl: string;
  origin?: string;
  limit?: number;
}): Promise<{ processed: number; sent: number; failed: number }> {
  const limit = params.limit ?? PLATFORM_NEWSLETTER_BATCH_SIZE;
  const nowIso = new Date().toISOString();

  // Promote due scheduled newsletters
  const { data: dueScheduled } = await params.admin
    .from("platform_newsletters")
    .select("id")
    .eq("status", "scheduled")
    .eq("is_template", false)
    .lte("scheduled_at", nowIso)
    .limit(20);

  for (const row of dueScheduled ?? []) {
    await params.admin
      .from("platform_newsletters")
      .update({
        status: "sending",
        started_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", String(row.id));
  }

  const { data: jobs, error } = await params.admin
    .from("platform_newsletter_outbox")
    .select(
      "id, newsletter_id, subscriber_id, email, locale, attempts, send_at",
    )
    .eq("status", "pending")
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!jobs?.length) {
    await finalizeCompletedNewsletters(params.admin);
    return { processed: 0, sent: 0, failed: 0 };
  }

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) {
    return { processed: 0, sent: 0, failed: 0 };
  }
  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) return { processed: 0, sent: 0, failed: 0 };

  const branding = await fetchTransactionalEmailBranding(params.admin);
  const origin = resolveNewsletterOrigin(params.origin);
  const fromName =
    platformEmail.config.from_name?.trim() || PLATFORM_NEWSLETTER_FROM_NAME;

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    const newsletterId = String(job.newsletter_id);
    const subscriberId = String(job.subscriber_id);

    const { data: sub } = await params.admin
      .from("platform_newsletter_subscribers")
      .select("opted_in, unsubscribe_token, locale")
      .eq("id", subscriberId)
      .maybeSingle();

    if (!sub?.opted_in) {
      await params.admin
        .from("platform_newsletter_outbox")
        .update({ status: "skipped", sent_at: new Date().toISOString() })
        .eq("id", job.id);
      continue;
    }

    try {
      const locale = normalizeAppLocale(
        typeof job.locale === "string" ? job.locale : sub.locale,
      );
      const localized = await loadOrBuildLocalizedContent({
        admin: params.admin,
        newsletterId,
        locale,
        supabaseUrl: params.supabaseUrl,
      });
      if (!localized) throw new Error("newsletter_missing");

      const labels = unsubscribeLabels(locale);
      const unsubscribeUrl = `${origin}/newsletter/abmelden/${String(sub.unsubscribe_token)}`;
      const html = buildNewsletterEmailHtml({
        brandName: branding.appName || PLATFORM_NEWSLETTER_FROM_NAME,
        logoUrl: branding.logoUrl,
        subject: localized.subject,
        preheader: localized.preheader,
        blocks: localized.blocks,
        unsubscribeUrl,
        unsubscribeLabel: labels.label,
        footerNote: labels.footer,
        lang: locale,
      });
      const text = buildNewsletterEmailText({
        brandName: branding.appName || PLATFORM_NEWSLETTER_FROM_NAME,
        subject: localized.subject,
        blocks: localized.blocks,
        unsubscribeUrl,
        unsubscribeLabel: labels.label,
        lang: locale,
      });

      const result = await sendViaSmtp(smtp, {
        to: String(job.email),
        subject: localized.subject,
        text,
        html,
        fromName,
      });

      if (!result.ok) throw new Error(result.error);

      await params.admin
        .from("platform_newsletter_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: Number(job.attempts ?? 0) + 1,
          last_error: null,
        })
        .eq("id", job.id);
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send_failed";
      const attempts = Number(job.attempts ?? 0) + 1;
      await params.admin
        .from("platform_newsletter_outbox")
        .update({
          status: attempts >= 3 ? "failed" : "pending",
          attempts,
          last_error: msg,
          send_at:
            attempts >= 3
              ? nowIso
              : new Date(Date.now() + attempts * 60_000).toISOString(),
        })
        .eq("id", job.id);
      failed += 1;
    }

    await sleep(PLATFORM_NEWSLETTER_SEND_GAP_MS);
  }

  await finalizeCompletedNewsletters(params.admin);
  return { processed: jobs.length, sent, failed };
}

async function finalizeCompletedNewsletters(
  admin: SupabaseClient,
): Promise<void> {
  const { data: sending } = await admin
    .from("platform_newsletters")
    .select("id")
    .eq("status", "sending")
    .eq("is_template", false)
    .limit(50);

  for (const row of sending ?? []) {
    const id = String(row.id);
    const { count } = await admin
      .from("platform_newsletter_outbox")
      .select("id", { count: "exact", head: true })
      .eq("newsletter_id", id)
      .eq("status", "pending");
    if ((count ?? 0) > 0) continue;
    await admin
      .from("platform_newsletters")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }
}

export async function buildNewsletterPreviewHtml(params: {
  admin: SupabaseClient;
  newsletterId: string;
  supabaseUrl: string;
  locale?: string;
  origin?: string;
}): Promise<{ html: string; subject: string } | null> {
  const localized = await loadOrBuildLocalizedContent({
    admin: params.admin,
    newsletterId: params.newsletterId,
    locale: params.locale ?? "de",
    supabaseUrl: params.supabaseUrl,
  });
  if (!localized) return null;

  const branding = await fetchTransactionalEmailBranding(params.admin);
  const origin = resolveNewsletterOrigin(params.origin);
  const labels = unsubscribeLabels(localized.lang);

  return {
    subject: localized.subject,
    html: buildNewsletterEmailHtml({
      brandName: branding.appName || PLATFORM_NEWSLETTER_FROM_NAME,
      logoUrl: branding.logoUrl,
      subject: localized.subject,
      preheader: localized.preheader,
      blocks: localized.blocks,
      unsubscribeUrl: `${origin}/newsletter/abmelden/preview`,
      unsubscribeLabel: labels.label,
      footerNote: labels.footer,
      lang: localized.lang,
    }),
  };
}
