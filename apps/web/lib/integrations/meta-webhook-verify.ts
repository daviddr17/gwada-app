import { createHmac, timingSafeEqual } from "crypto";

/**
 * Nach Advanced Access `pages_messaging` (+ IG: `instagram_manage_messages`)
 * auf `true` setzen → Inbound-Schreiben in die DB.
 * Bis dahin: Connect-Historie + täglicher Cron `meta-inbox-sync`.
 */
export function metaWebhookInboundEnabled(): boolean {
  return process.env.META_WEBHOOK_INBOUND_ENABLED?.trim() === "true";
}

/**
 * Meta Console GET Verify (`hub.mode=subscribe`).
 * Returns the challenge string to echo, or null → 403.
 */
export function metaWebhookVerifyChallenge(params: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
  expectedToken?: string | null;
}): string | null {
  const expected = (
    params.expectedToken ?? process.env.META_WEBHOOK_VERIFY_TOKEN
  )?.trim();
  if (
    params.mode === "subscribe" &&
    expected &&
    params.token === expected &&
    params.challenge
  ) {
    return params.challenge;
  }
  return null;
}

/**
 * `x-hub-signature-256`. Without a configured App Secret, verification is skipped
 * (local/dev). Live should resolve secret via env or platform_integrations.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret?: string | null,
): boolean {
  const secret = (appSecret ?? process.env.META_APP_SECRET)?.trim();
  if (!secret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
