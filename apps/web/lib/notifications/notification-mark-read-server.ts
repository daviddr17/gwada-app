import "server-only";

import { markReviewReadServer } from "@/lib/reviews/mark-review-read-server";
import { markAllReviewsReadForUserServer } from "@/lib/reviews/mark-all-reviews-read-server";
import {
  isNotificationModuleId,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { REVIEW_PLATFORMS } from "@/lib/constants/review-platforms";
import { markConversationReadServer } from "@/lib/contact-messages/mark-conversation-read-server";
import {
  isContactMessagePlatform,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function markNotificationReadServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: NotificationModuleId;
    itemId?: string | null;
    meta?: Record<string, string>;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { module, itemId, meta, restaurantId, userId } = params;

  if (!isNotificationModuleId(module)) {
    return { ok: false, error: "invalid_module" };
  }

  switch (module) {
    case "messages": {
      const contactId = itemId ?? meta?.contactId;
      const platformRaw = meta?.platform ?? "gwada";
      if (
        !contactId ||
        !isContactMessagePlatform(platformRaw)
      ) {
        return { ok: false, error: "invalid_request" };
      }
      const result = await markConversationReadServer(sb, {
        restaurantId,
        userId,
        conversationKey: contactId,
        platform: platformRaw as ContactMessagePlatform,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "reviews": {
      if (!itemId) {
        const all = await markAllReviewsReadForUserServer(sb, {
          restaurantId,
          userId,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const platform = meta?.platform;
      if (
        !platform ||
        !(REVIEW_PLATFORMS as readonly string[]).includes(platform)
      ) {
        return { ok: false, error: "invalid_request" };
      }
      const result = await markReviewReadServer(sb, {
        restaurantId,
        userId,
        platform: platform as ReviewPlatform,
        reviewId: itemId,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "reservations": {
      const reservationId = itemId ?? meta?.reservationId;
      if (!reservationId) return { ok: false, error: "invalid_request" };
      const { error } = await sb.from("restaurant_reservation_notification_dismissals").upsert(
        {
          profile_id: userId,
          restaurant_id: restaurantId,
          reservation_id: reservationId,
        },
        { onConflict: "profile_id,reservation_id" },
      );
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    case "changelog": {
      const changelogEntryId = itemId ?? meta?.changelogEntryId;
      if (!changelogEntryId) return { ok: false, error: "invalid_request" };
      const { error } = await sb.from("platform_changelog_reads").upsert(
        {
          profile_id: userId,
          changelog_entry_id: changelogEntryId,
        },
        { onConflict: "profile_id,changelog_entry_id" },
      );
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    default:
      return { ok: false, error: "unsupported_module" };
  }
}
