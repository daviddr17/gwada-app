#!/usr/bin/env node
/**
 * Bestätigungs-E-Mails (Signup) erneut per Plattform-SMTP senden — nicht über GoTrue-Mail.
 *
 * Usage:
 *   pnpm exec dotenv -e .env.production -- node scripts/resend-signup-confirmation-live.mjs \
 *     daniel-dreyer@gmx.de petradreyer@gmx.net
 */
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const ORIGIN = (process.env.GWADA_PUBLIC_SITE_URL || "https://gwada.app").replace(
  /\/$/,
  "",
);
const RESTAURANT_SLUG = process.env.GWADA_RESTAURANT_SLUG || "zurschlagd";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function smtpCredentialsFromConfig(config) {
  const email = (config.email || config.from_email || "").trim();
  const password = (config.password || "").trim();
  const smtpHost = (config.smtp_host || "").trim();
  const smtpPort = Number.parseInt(String(config.smtp_port ?? ""), 10);
  if (!email || !password || !smtpHost || !Number.isFinite(smtpPort)) return null;
  return { email, password, smtpHost, smtpPort };
}

function buildSignupConfirmationEmailHtml({ appName, confirmLink }) {
  return `<!DOCTYPE html><html lang="de"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p><strong>${appName}</strong></p>
<p><strong>E-Mail-Adresse bestätigen</strong></p>
<p>Bitte tippe auf den Button, um dein Konto zu aktivieren. Danach kannst du die Restaurant-Einladung annehmen.</p>
<p><a href="${confirmLink}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#0f766e;color:#fff;text-decoration:none;font-weight:600">E-Mail bestätigen</a></p>
<p style="font-size:12px;color:#666">Falls der Button nicht funktioniert: <a href="${confirmLink}">${confirmLink}</a></p>
<p style="font-size:12px;color:#666">Du hast dich über eine Restaurant-Einladung registriert. Wenn du das nicht warst, kannst du diese Nachricht ignorieren.</p>
</body></html>`;
}

function buildSignupConfirmationEmailText({ appName, confirmLink }) {
  return [
    appName,
    "",
    "E-Mail-Adresse bestätigen",
    "",
    "Bitte öffne den Link, um dein Konto zu aktivieren. Danach kannst du die Restaurant-Einladung annehmen.",
    "",
    confirmLink,
    "",
    "Wenn du dich nicht registriert hast, ignoriere diese E-Mail.",
  ].join("\n");
}

async function findAuthUser(admin, email) {
  const normalized = normalizeEmail(email);
  let page = 1;
  while (page <= 25) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const match = (data.users ?? []).find(
      (u) => normalizeEmail(u.email ?? "") === normalized,
    );
    if (match) return match;
    if ((data.users?.length ?? 0) < 200) break;
    page += 1;
  }
  return null;
}

async function findPendingInviteToken(admin, restaurantId, email) {
  const normalized = normalizeEmail(email);
  const { data: staff, error: staffError } = await admin
    .from("restaurant_staff")
    .select("id, email")
    .eq("restaurant_id", restaurantId)
    .ilike("email", normalized);
  if (staffError) throw new Error(`staff: ${staffError.message}`);
  const staffRow = (staff ?? []).find(
    (s) => normalizeEmail(s.email ?? "") === normalized,
  );
  if (!staffRow) return null;

  const { data: invites, error: inviteError } = await admin
    .from("restaurant_staff_invites")
    .select("invite_token, status, expires_at")
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffRow.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  if (inviteError) throw new Error(`invites: ${inviteError.message}`);
  return invites?.[0]?.invite_token ?? null;
}

async function sendSignupConfirmation({ admin, smtp, appName, email, confirmLink }) {
  const fromName = appName;
  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost,
    port: smtp.smtpPort,
    secure: smtp.smtpPort === 465,
    auth: { user: smtp.email, pass: smtp.password },
  });

  const content = { appName, confirmLink };
  try {
    await transporter.sendMail({
      from: { name: fromName, address: smtp.email },
      to: email,
      subject: `E-Mail bestätigen — ${appName}`,
      text: buildSignupConfirmationEmailText(content),
      html: buildSignupConfirmationEmailHtml(content),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    transporter.close();
  }
}

async function main() {
  const emails = process.argv.slice(2).map(normalizeEmail).filter(Boolean);
  if (emails.length === 0) {
    console.error(
      "Usage: node scripts/resend-signup-confirmation-live.mjs <email> [email2 …]",
    );
    process.exit(1);
  }

  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_UPSTREAM_URL ||
    ""
  ).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY nötig.");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: platformEmail, error: platformError } = await admin
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "email")
    .maybeSingle();
  if (platformError || !platformEmail?.enabled) {
    console.error("Plattform-SMTP nicht verfügbar.", platformError?.message);
    process.exit(1);
  }

  const smtp = smtpCredentialsFromConfig(platformEmail.config ?? {});
  if (!smtp) {
    console.error("SMTP-Konfiguration unvollständig.");
    process.exit(1);
  }

  const { data: branding } = await admin
    .from("platform_app_settings")
    .select("app_name")
    .maybeSingle();
  const appName = (branding?.app_name || "Gwada").trim() || "Gwada";

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, slug")
    .eq("slug", RESTAURANT_SLUG)
    .maybeSingle();
  if (restaurantError || !restaurant?.id) {
    console.error(`Restaurant ${RESTAURANT_SLUG} nicht gefunden.`);
    process.exit(1);
  }

  let failed = 0;
  for (const email of emails) {
    console.log(`\n=== ${email} ===`);
    const user = await findAuthUser(admin, email);
    if (!user) {
      console.error("✗ Kein Auth-User");
      failed += 1;
      continue;
    }
    if (user.email_confirmed_at) {
      console.log("• Bereits bestätigt — übersprungen");
      continue;
    }

    const inviteToken = await findPendingInviteToken(admin, restaurant.id, email);
    const nextPath = inviteToken
      ? `/einladung/${encodeURIComponent(inviteToken)}`
      : "/dashboard";
    const redirectTo = `${ORIGIN}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "signup",
        email,
        options: { redirectTo },
      });
    const confirmLink = linkData?.properties?.action_link ?? null;
    if (linkError || !confirmLink) {
      console.error("✗ generateLink fehlgeschlagen:", linkError?.message);
      failed += 1;
      continue;
    }

    const sent = await sendSignupConfirmation({
      admin,
      smtp,
      appName,
      email,
      confirmLink,
    });
    if (!sent.ok) {
      console.error("✗ SMTP:", sent.error);
      failed += 1;
      continue;
    }

    console.log("✓ Bestätigungs-Mail gesendet");
    console.log(`  Einladung: ${inviteToken ? "ja" : "nein (Dashboard-Fallback)"}`);
  }

  if (failed > 0) process.exit(1);
  console.log("\nFertig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
