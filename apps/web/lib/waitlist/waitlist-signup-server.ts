import "server-only";

import {
  buildTransactionalEmailHtmlFromText,
  buildTransactionalEmailTextFromParts,
} from "@/lib/email/transactional-email-from-text";
import { fetchTransactionalEmailBranding } from "@/lib/email/fetch-transactional-email-branding";
import { sendViaSmtp } from "@/lib/email/send-via-smtp";
import { resolveEmailSender } from "@/lib/email/email-delivery";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type WaitlistSignupInput = {
  givenName: string;
  familyName: string;
  email: string;
  note?: string | null;
};

export type WaitlistSignupResult =
  | { ok: true; alreadyRegistered: boolean }
  | { ok: false; error: string; status: number };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function fetchSuperadminEmails(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<string[]> {
  const { data, error } = await admin.from("platform_superadmins").select("profile_id");
  if (error) {
    console.warn("[waitlist] superadmin list", error.message);
    return [];
  }

  const emails: string[] = [];
  for (const row of data ?? []) {
    const profileId = (row as { profile_id: string }).profile_id;
    const { data: userData, error: userErr } =
      await admin.auth.admin.getUserById(profileId);
    if (userErr) {
      console.warn("[waitlist] getUserById", profileId, userErr.message);
      continue;
    }
    const email = userData.user?.email?.trim();
    if (email) emails.push(email);
  }
  return [...new Set(emails)];
}

async function sendWaitlistAdminNotification(params: {
  origin: string;
  entry: {
    givenName: string;
    familyName: string;
    email: string;
    note: string | null;
    createdAt: string;
  };
  recipientEmails: string[];
}): Promise<void> {
  if (params.recipientEmails.length === 0) return;

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const platformEmail = await fetchPlatformEmailSmtpConfigAdmin();
  if (!platformEmail?.enabled) {
    console.warn("[waitlist] platform SMTP not configured — admin notify skipped");
    return;
  }

  const smtp = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtp) return;

  const branding = await fetchTransactionalEmailBranding(admin);
  const sender = resolveEmailSender({
    useCustom: false,
    fromEmail: smtp.email,
    fromName: platformEmail.config.from_name ?? branding.appName,
  });

  const name = [params.entry.givenName, params.entry.familyName]
    .filter(Boolean)
    .join(" ");
  const when = new Date(params.entry.createdAt).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const noteBlock = params.entry.note?.trim()
    ? `Notiz:\n${params.entry.note.trim()}`
    : "Notiz: —";

  const text = [
    `Name: ${name}`,
    `E-Mail: ${params.entry.email}`,
    noteBlock,
    `Eingetragen am: ${when}`,
    "",
    `Warteliste im Superadmin: ${params.origin.replace(/\/$/, "")}/superadmin/warteliste`,
  ].join("\n");

  const html = buildTransactionalEmailHtmlFromText({
    brandName: branding.appName,
    logoUrl: branding.logoUrl,
    headline: "Neue Wartelisten-Anmeldung",
    intro: "Jemand hat sich für die Gwada-Warteliste eingetragen.",
    text,
    cta: {
      label: "Warteliste öffnen",
      href: `${params.origin.replace(/\/$/, "")}/superadmin/warteliste`,
    },
    footerNote: "Diese E-Mail geht an alle Superadmins.",
  });

  const plain = buildTransactionalEmailTextFromParts({
    headline: "Neue Wartelisten-Anmeldung",
    intro: "Jemand hat sich für die Gwada-Warteliste eingetragen.",
    text,
    footerNote: "Diese E-Mail geht an alle Superadmins.",
  });

  await Promise.all(
    params.recipientEmails.map((to) =>
      sendViaSmtp(smtp, {
        to,
        subject: `Warteliste: ${name} (${params.entry.email})`,
        text: plain,
        html,
        fromName: sender.name,
      }).catch((err) => {
        console.warn("[waitlist] admin notify failed", to, err);
      }),
    ),
  );
}

export async function submitWaitlistSignup(
  input: WaitlistSignupInput,
  origin: string,
): Promise<WaitlistSignupResult> {
  const givenName = input.givenName.trim();
  const familyName = input.familyName.trim();
  const email = normalizeEmail(input.email);
  const note = input.note?.trim() || null;

  if (!givenName || !familyName) {
    return { ok: false, error: "name_required", status: 400 };
  }
  if (!email || !email.includes("@")) {
    return { ok: false, error: "invalid_email", status: 400 };
  }
  if (note && note.length > 2000) {
    return { ok: false, error: "note_too_long", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { data: existing } = await admin
    .from("platform_waitlist_entries")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyRegistered: true };
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await admin
    .from("platform_waitlist_entries")
    .insert({
      given_name: givenName,
      family_name: familyName,
      email,
      note,
    })
    .select("id, given_name, family_name, email, note, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: true, alreadyRegistered: true };
    }
    console.warn("[waitlist] insert", error.message);
    return { ok: false, error: "insert_failed", status: 500 };
  }

  const row = inserted as {
    given_name: string;
    family_name: string;
    email: string;
    note: string | null;
    created_at: string;
  };

  const superadminEmails = await fetchSuperadminEmails(admin);
  void sendWaitlistAdminNotification({
    origin,
    entry: {
      givenName: row.given_name,
      familyName: row.family_name,
      email: row.email,
      note: row.note,
      createdAt: row.created_at ?? now,
    },
    recipientEmails: superadminEmails,
  });

  return { ok: true, alreadyRegistered: false };
}
