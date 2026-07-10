import "server-only";

import { createVerify } from "crypto";

const LEXWARE_WEBHOOK_PUBLIC_KEY_URL =
  "https://developers.lexware.io/assets/lexware-webhook-public-key.pem";

let cachedPublicKeyPem: string | null = null;

async function loadLexwareWebhookPublicKeyPem(): Promise<string | null> {
  const fromEnv = process.env.LEXWARE_WEBHOOK_PUBLIC_KEY?.trim();
  if (fromEnv) return fromEnv;

  if (cachedPublicKeyPem) return cachedPublicKeyPem;

  try {
    const res = await fetch(LEXWARE_WEBHOOK_PUBLIC_KEY_URL, { cache: "force-cache" });
    if (!res.ok) return null;
    const pem = (await res.text()).trim();
    if (!pem.includes("BEGIN PUBLIC KEY")) return null;
    cachedPublicKeyPem = pem;
    return pem;
  } catch {
    return null;
  }
}

export async function verifyLexofficeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const skip =
    process.env.LEXWARE_WEBHOOK_SKIP_VERIFY?.trim() === "true" ||
    process.env.NODE_ENV === "development";
  if (skip) return true;

  const signature = signatureHeader?.trim();
  if (!signature || !rawBody) return false;

  const pem = await loadLexwareWebhookPublicKeyPem();
  if (!pem) return false;

  try {
    const verify = createVerify("RSA-SHA512");
    verify.update(rawBody);
    verify.end();
    return verify.verify(pem, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export type LexofficeWebhookPayload = {
  organizationId: string;
  eventType: string;
  resourceId: string;
  eventDate?: string;
};

export function parseLexofficeWebhookPayload(
  rawBody: string,
): LexofficeWebhookPayload | null {
  try {
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const organizationId =
      typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    const eventType =
      typeof body.eventType === "string" ? body.eventType.trim().toLowerCase() : "";
    const resourceId =
      typeof body.resourceId === "string" ? body.resourceId.trim() : "";
    if (!organizationId || !eventType || !resourceId) return null;
    return {
      organizationId,
      eventType,
      resourceId,
      eventDate:
        typeof body.eventDate === "string" ? body.eventDate : undefined,
    };
  } catch {
    return null;
  }
}
