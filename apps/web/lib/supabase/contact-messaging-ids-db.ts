import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type ContactMessagingIdRow = {
  id: string;
  contact_id: string;
  platform: "facebook" | "instagram";
  external_sender_id: string;
  label: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type ContactMessagingIdLookup = Pick<
  ContactMessagingIdRow,
  "platform" | "external_sender_id" | "is_primary" | "sort_order"
>;

export function primaryMessagingId(
  rows: ContactMessagingIdLookup[],
  platform: "facebook" | "instagram",
): string | null {
  const match = rows
    .filter((r) => r.platform === platform)
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order,
    );
  return match[0]?.external_sender_id?.trim() || null;
}

export function hasMessagingPlatform(
  rows: ContactMessagingIdRow[],
  platform: "facebook" | "instagram",
): boolean {
  return Boolean(primaryMessagingId(rows, platform));
}
