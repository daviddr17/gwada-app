import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { insertContactMessageIfNew } from "@/lib/contacts/contact-inbound-message-insert";
import { resolveOrCreateContactForMetaInbound } from "@/lib/contacts/resolve-or-create-inbound-contact-server";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    messaging?: Array<MetaMessagingEvent>;
  }>;
};

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
  };
};

export function metaWebhookInboundEnabled(): boolean {
  return process.env.META_WEBHOOK_INBOUND_ENABLED?.trim() === "true";
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.META_APP_SECRET?.trim();
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

async function restaurantIdForPageId(
  admin: SupabaseClient,
  pageId: string,
): Promise<{ restaurantId: string; platform: "facebook" | "instagram" } | null> {
  const { data: rows } = await admin
    .from("restaurant_integrations")
    .select("restaurant_id, integration_key, status, config")
    .in("integration_key", ["facebook", "instagram"])
    .eq("status", "working");

  for (const raw of rows ?? []) {
    const row = raw as {
      restaurant_id: string;
      integration_key: string;
      config: unknown;
    };
    const cfg = oauthConfigFromJson<MetaOAuthIntegrationConfig>(row.config);
    if (cfg.page_id?.trim() === pageId) {
      return {
        restaurantId: row.restaurant_id,
        platform:
          row.integration_key === "instagram" ? "instagram" : "facebook",
      };
    }
    if (cfg.instagram_business_account_id?.trim() === pageId) {
      return { restaurantId: row.restaurant_id, platform: "instagram" };
    }
  }
  return null;
}

function platformFromWebhookObject(
  object: string | undefined,
  resolved: "facebook" | "instagram",
): "facebook" | "instagram" {
  if (object === "instagram") return "instagram";
  if (object === "page") return "facebook";
  return resolved;
}

export async function handleMetaMessagingWebhook(
  admin: SupabaseClient,
  body: MetaWebhookBody,
): Promise<{ ok: boolean; processed: number; reason?: string }> {
  if (!metaWebhookInboundEnabled()) {
    return { ok: true, processed: 0, reason: "inbound_disabled" };
  }

  let processed = 0;

  for (const entry of body.entry ?? []) {
    const pageId = entry.id?.trim();
    if (!pageId) continue;

    const resolved = await restaurantIdForPageId(admin, pageId);
    if (!resolved) continue;

    const platform = platformFromWebhookObject(body.object, resolved.platform);

    for (const event of entry.messaging ?? []) {
      const message = event.message;
      if (!message?.mid || message.is_echo) continue;

      const senderId = event.sender?.id?.trim();
      const text = message.text?.trim();
      if (!senderId || !text) continue;

      const contactId = await resolveOrCreateContactForMetaInbound(admin, {
        restaurantId: resolved.restaurantId,
        platform,
        senderId,
      });
      if (!contactId) continue;

      const externalSourceId = `meta:${platform}:${message.mid}`;
      const createdAt = message.mid && event.timestamp
        ? new Date(event.timestamp).toISOString()
        : undefined;

      const inserted = await insertContactMessageIfNew(admin, {
        restaurantId: resolved.restaurantId,
        contactId,
        platform,
        direction: "inbound",
        body: text,
        externalSourceId,
        createdAt,
      });
      if (inserted) processed += 1;
    }
  }

  return { ok: true, processed };
}
