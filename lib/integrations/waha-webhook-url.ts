import "server-only";

import { getPublicSiteUrl } from "@/lib/public-env";

export function resolveWahaWebhookPublicUrl(): string | null {
  const base =
    getPublicSiteUrl()?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`
      : "");
  if (!base || !/^https?:\/\//i.test(base)) return null;
  return `${base.replace(/\/+$/, "")}/api/integrations/waha/webhook`;
}

export function wahaSessionWebhookConfig(restaurantId: string): {
  webhooks: { url: string; events: string[] }[];
  metadata: Record<string, string>;
} | null {
  const url = resolveWahaWebhookPublicUrl();
  if (!url) return null;
  return {
    webhooks: [
      {
        url,
        events: ["message"],
      },
    ],
    metadata: {
      "gwada.restaurant_id": restaurantId,
    },
  };
}
