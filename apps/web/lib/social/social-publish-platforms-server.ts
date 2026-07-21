import "server-only";

import {
  isNewsPlatform,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import { getNewsConnectorPublicInfo } from "@/lib/news/connectors/registry";
import { SOCIAL_DEFAULT_PUBLISH_PLATFORMS } from "@/lib/social/social-publish-platforms";

/**
 * Bevorzugte Kit-Plattformen ∩ tatsächlich verbundene Kanäle.
 * `gwada` bleibt immer drin, wenn im Kit gewählt (kein OAuth nötig).
 */
export async function resolveConnectedPublishPlatforms(
  restaurantId: string,
  preferred: readonly NewsPlatform[],
): Promise<NewsPlatform[]> {
  const wanted = preferred.filter(isNewsPlatform);
  const base = wanted.length ? wanted : [...SOCIAL_DEFAULT_PUBLISH_PLATFORMS];
  const connectors = await getNewsConnectorPublicInfo(restaurantId);
  const connected = new Set(
    connectors
      .filter((c) => c.key === "gwada" || c.connected)
      .map((c) => c.key)
      .filter(isNewsPlatform),
  );

  const resolved = base.filter((p) => connected.has(p));
  if (resolved.length) return resolved;
  return ["gwada"];
}
