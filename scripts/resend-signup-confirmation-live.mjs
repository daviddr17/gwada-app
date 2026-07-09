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
import {
  buildSignupConfirmationEmailHtml,
  buildSignupConfirmationEmailText,
  generateAdminAuthActionLink,
} from "./lib/signup-confirmation-email-ops.mjs";

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

function brandingLogoAbsoluteUrl(logoPath) {
  const path = logoPath?.trim();
  if (!path) return null;
  const encoded = path.split("/").map((seg) => encodeURIComponent(seg)).join("/");
  const objectPath = `/storage/v1/object/public/platform-branding/${encoded}`;
  return `${ORIGIN}/sb${objectPath}`;
}

function brandingFromSettingsRow(row) {
  const appName = (row?.app_name || "Gwada").trim() || "Gwada";
  return {
    appName,
    logoUrl: brandingLogoAbsoluteUrl(row?.logo_path),
  };
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

async function sendSignupConfirmation({ smtp, branding, email, confirmLink }) {
  const fromName = branding.appName;
  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost,
    port: smtp.smtpPort,
    secure: smtp.smtpPort === 465,
    auth: { user: smtp.email, pass: smtp.password },
  });

  const content = {
    appName: branding.appName,
    confirmLink,
    logoUrl: branding.logoUrl,
  };
  try {
    await transporter.sendMail({
      from: { name: fromName, address: smtp.email },
      to: email,
      subject: `E-Mail bestätigen — ${branding.appName}`,
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

  const { data: brandingRow } = await admin
    .from("platform_app_settings")
    .select("app_name, logo_path")
    .maybeSingle();
  const branding = brandingFromSettingsRow(brandingRow);

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

    const linkResult = await generateAdminAuthActionLink(
      admin,
      {
        type: "signup",
        email,
        options: { redirectTo },
      },
      { siteUrl: ORIGIN, redirectTo },
    );
    if (!linkResult.ok) {
      console.error("✗ generateLink fehlgeschlagen:", linkResult.error);
      failed += 1;
      continue;
    }

    const confirmLink = linkResult.actionLink;

    const sent = await sendSignupConfirmation({
      smtp,
      branding,
      email,
      confirmLink,
    });
    if (!sent.ok) {
      console.error("✗ SMTP:", sent.error);
      failed += 1;
      continue;
    }

    console.log("✓ Bestätigungs-Mail gesendet");
    console.log(`  Link: ${confirmLink}`);
    console.log(`  Einladung: ${inviteToken ? "ja" : "nein (Dashboard-Fallback)"}`);
  }

  if (failed > 0) process.exit(1);
  console.log("\nFertig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
