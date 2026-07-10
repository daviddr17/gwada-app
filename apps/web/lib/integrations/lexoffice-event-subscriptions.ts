import "server-only";

import {
  fetchLexofficeJson,
  LEXOFFICE_API_BASE,
} from "@/lib/integrations/lexoffice-api";
import { getPublicSiteUrl } from "@/lib/public-env";

export type LexofficeEventSubscription = {
  id: string;
  eventType: string;
  callbackUrl?: string;
};

export const LEXOFFICE_WEBHOOK_EVENT_TYPES = [
  "contact.changed",
  "contact.created",
  "contact.deleted",
  "invoice.created",
  "invoice.changed",
  "invoice.status.changed",
  "quotation.created",
  "quotation.changed",
  "quotation.status.changed",
  "voucher.created",
  "voucher.changed",
  "voucher.status.changed",
  "payment.changed",
] as const;

export type LexofficeWebhookEventType =
  (typeof LEXOFFICE_WEBHOOK_EVENT_TYPES)[number];

export function resolveLexofficeWebhookPublicUrl(): string | null {
  const base =
    getPublicSiteUrl()?.trim() ||
    process.env.GWADA_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/api/webhooks/lexoffice`;
}

export async function listLexofficeEventSubscriptions(
  apiKey: string,
): Promise<
  | { ok: true; subscriptions: LexofficeEventSubscription[] }
  | { ok: false; error: string }
> {
  const result = await fetchLexofficeJson<{
    content?: LexofficeEventSubscription[];
  }>(apiKey, "/v1/event-subscriptions");
  if (!result.ok) return result;
  return { ok: true, subscriptions: result.data.content ?? [] };
}

export async function createLexofficeEventSubscription(
  apiKey: string,
  params: { eventType: LexofficeWebhookEventType; callbackUrl: string },
): Promise<
  | { ok: true; subscription: LexofficeEventSubscription }
  | { ok: false; error: string }
> {
  const result = await fetchLexofficeJson<LexofficeEventSubscription>(
    apiKey,
    "/v1/event-subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        eventType: params.eventType,
        callbackUrl: params.callbackUrl,
      }),
    },
  );
  if (!result.ok) return result;
  if (!result.data.id) {
    return { ok: false, error: "Lexware hat keine Subscription angelegt." };
  }
  return { ok: true, subscription: result.data };
}

export async function deleteLexofficeEventSubscription(
  apiKey: string,
  subscriptionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, error: "API-Key fehlt." };

  let res: Response;
  try {
    res = await fetch(
      `${LEXOFFICE_API_BASE}/v1/event-subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${trimmed}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text || `Lexware API (${res.status})` };
  }
  return { ok: true };
}

export async function registerLexofficeWebhooksForRestaurant(
  apiKey: string,
  callbackUrl: string,
): Promise<
  | { ok: true; subscriptionIds: Record<string, string> }
  | { ok: false; error: string }
> {
  const existing = await listLexofficeEventSubscriptions(apiKey);
  if (!existing.ok) return existing;

  const subscriptionIds: Record<string, string> = {};
  for (const sub of existing.subscriptions) {
    if (sub.callbackUrl === callbackUrl && sub.eventType && sub.id) {
      subscriptionIds[sub.eventType] = sub.id;
    }
  }

  for (const eventType of LEXOFFICE_WEBHOOK_EVENT_TYPES) {
    if (subscriptionIds[eventType]) continue;
    const created = await createLexofficeEventSubscription(apiKey, {
      eventType,
      callbackUrl,
    });
    if (!created.ok) {
      console.warn("[lexoffice] webhook subscription failed", eventType, created.error);
      continue;
    }
    subscriptionIds[eventType] = created.subscription.id;
  }

  return { ok: true, subscriptionIds };
}

export async function unregisterLexofficeWebhooks(
  apiKey: string,
  subscriptionIds: Record<string, string>,
): Promise<void> {
  for (const id of Object.values(subscriptionIds)) {
    if (!id) continue;
    await deleteLexofficeEventSubscription(apiKey, id).catch((e) => {
      console.warn("[lexoffice] delete webhook subscription", id, e);
    });
  }
}
