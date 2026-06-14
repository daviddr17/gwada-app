import "server-only";

import { markAllChangelogReadForUserServer } from "@/lib/changelog/mark-all-changelog-read-server";
import { markAllConversationsReadForUserServer } from "@/lib/contact-messages/mark-all-conversations-read-server";
import { markReviewReadServer } from "@/lib/reviews/mark-review-read-server";
import { markAllReviewsReadForUserServer } from "@/lib/reviews/mark-all-reviews-read-server";
import {
  isNotificationModuleId,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import {
  dismissAllInventoryLowStockNotifications,
  dismissInventoryLowStockNotification,
} from "@/lib/notifications/notification-inventory-server";
import {
  dismissAllReservationNotifications,
  dismissReservationNotification,
} from "@/lib/notifications/notification-reservations-server";
import {
  dismissAllStaffShiftNotifications,
  dismissStaffShiftNotification,
} from "@/lib/notifications/notification-staff-shift-server";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { REVIEW_PLATFORMS } from "@/lib/constants/review-platforms";
import { markConversationReadServer } from "@/lib/contact-messages/mark-conversation-read-server";
import {
  isContactMessagePlatform,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function adminOrUserClient(sb: SupabaseClient): SupabaseClient {
  return createSupabaseAdminClient() ?? sb;
}

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

  const admin = adminOrUserClient(sb);

  switch (module) {
    case "messages": {
      if (!itemId) {
        const all = await markAllConversationsReadForUserServer(admin, {
          restaurantId,
          userId,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const contactId = itemId ?? meta?.contactId;
      const platformRaw = meta?.platform ?? "gwada";
      if (!contactId || !isContactMessagePlatform(platformRaw)) {
        return { ok: false, error: "invalid_request" };
      }
      const result = await markConversationReadServer(admin, {
        restaurantId,
        userId,
        conversationKey: contactId,
        platform: platformRaw as ContactMessagePlatform,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "reviews": {
      if (!itemId) {
        const all = await markAllReviewsReadForUserServer(admin, {
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

    case "reservations_pending":
    case "reservations_change_request":
    case "reservations_cancellation": {
      if (!itemId) {
        const all = await dismissAllReservationNotifications(admin, {
          restaurantId,
          userId,
          module,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const reservationId = itemId ?? meta?.reservationId;
      if (!reservationId) return { ok: false, error: "invalid_request" };
      const result = await dismissReservationNotification(sb, {
        restaurantId,
        userId,
        reservationId,
        module,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "staff_shift_start":
    case "staff_shift_end": {
      const kind = module === "staff_shift_start" ? "start" : "end";
      if (!itemId) {
        const all = await dismissAllStaffShiftNotifications(admin, {
          restaurantId,
          userId,
          kind,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const shiftId = itemId ?? meta?.shiftId;
      const itemKind =
        meta?.kind ??
        (module === "staff_shift_start" ? "start" : "end");
      if (!shiftId || (itemKind !== "start" && itemKind !== "end")) {
        return { ok: false, error: "invalid_request" };
      }
      const result = await dismissStaffShiftNotification(sb, {
        restaurantId,
        userId,
        shiftId,
        kind: itemKind,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "inventory_low_stock": {
      if (!itemId) {
        const all = await dismissAllInventoryLowStockNotifications(admin, {
          restaurantId,
          userId,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const ingredientId = itemId ?? meta?.ingredientId;
      if (!ingredientId) return { ok: false, error: "invalid_request" };
      const result = await dismissInventoryLowStockNotification(sb, {
        restaurantId,
        userId,
        ingredientId,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "changelog": {
      const changelogEntryId = itemId ?? meta?.changelogEntryId;
      if (!changelogEntryId) {
        const all = await markAllChangelogReadForUserServer(admin, { userId });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
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
