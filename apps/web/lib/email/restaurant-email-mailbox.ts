import type { RestaurantEmailStatus } from "@/lib/types/restaurant-integration";

/** Eigenes Postfach (IMAP/SMTP, Gmail oder Outlook) — nicht Gwada-Standard. */
export function isRestaurantEmailMailboxStatus(
  status: RestaurantEmailStatus | string | null | undefined,
): boolean {
  return status === "custom" || status === "gmail" || status === "outlook";
}

export function isRestaurantEmailOAuthStatus(
  status: RestaurantEmailStatus | string | null | undefined,
): status is "gmail" | "outlook" {
  return status === "gmail" || status === "outlook";
}
