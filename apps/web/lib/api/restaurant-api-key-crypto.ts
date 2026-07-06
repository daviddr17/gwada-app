import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "gwada_sk_live_";

export function generateRestaurantApiKeySecret(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function hashRestaurantApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function restaurantApiKeyLookupPrefix(secret: string): string {
  return secret.slice(0, Math.min(secret.length, 24));
}

export function isRestaurantApiKeySecretFormat(value: string): boolean {
  return value.startsWith(KEY_PREFIX) && value.length >= KEY_PREFIX.length + 16;
}
