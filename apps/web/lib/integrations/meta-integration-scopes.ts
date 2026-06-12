import {
  catalogForProvider,
  isScopeEntryGranted,
  type IntegrationScopeMeta,
} from "@/lib/constants/integration-oauth-scopes";
import { metaScopeMissingMessage } from "@/lib/integrations/meta-graph-error-message";

const FACEBOOK_NEWS_SCOPE_IDS = [
  "pages_read_engagement",
  "pages_read_user_content",
] as const;

const INSTAGRAM_NEWS_SCOPE_IDS = ["instagram_basic"] as const;

const FACEBOOK_MESSAGES_SCOPE_IDS = ["pages_messaging"] as const;

const INSTAGRAM_MESSAGES_SCOPE_IDS = ["instagram_manage_messages"] as const;

export function missingMetaScopes(
  platform: "facebook" | "instagram",
  grantedScopes: string[],
  requiredScopeIds: readonly string[],
): IntegrationScopeMeta[] {
  if (!grantedScopes.length) return [];
  const granted = new Set(grantedScopes);
  const catalog = catalogForProvider(platform);
  return requiredScopeIds
    .filter((id) => !granted.has(id))
    .map((id) => catalog.find((s) => (s.oauthScopeId ?? s.id) === id))
    .filter((s): s is IntegrationScopeMeta => Boolean(s));
}

export function metaNewsScopeError(
  platform: "facebook" | "instagram",
  grantedScopes: string[],
): string | null {
  const required =
    platform === "facebook"
      ? FACEBOOK_NEWS_SCOPE_IDS
      : INSTAGRAM_NEWS_SCOPE_IDS;
  const missing = missingMetaScopes(platform, grantedScopes, required);
  if (!missing.length) return null;
  const first = missing[0]!;
  return metaScopeMissingMessage({
    platform,
    feature: "news",
    scopeId: first.oauthScopeId ?? first.id,
    scopeLabel: first.label,
  });
}

export function metaMessagesScopeError(
  platform: "facebook" | "instagram",
  grantedScopes: string[],
): string | null {
  const required =
    platform === "facebook"
      ? FACEBOOK_MESSAGES_SCOPE_IDS
      : INSTAGRAM_MESSAGES_SCOPE_IDS;
  const missing = missingMetaScopes(platform, grantedScopes, required);
  if (!missing.length) return null;
  const first = missing[0]!;
  return metaScopeMissingMessage({
    platform,
    feature: "messages",
    scopeId: first.oauthScopeId ?? first.id,
    scopeLabel: first.label,
  });
}

export function isScopeEntryMissing(
  scope: IntegrationScopeMeta,
  grantedOAuthIds: Set<string>,
  requestedOAuthIds: Set<string>,
): boolean {
  const oauthId = scope.oauthScopeId ?? scope.id;
  return requestedOAuthIds.has(oauthId) && !isScopeEntryGranted(scope, grantedOAuthIds);
}
