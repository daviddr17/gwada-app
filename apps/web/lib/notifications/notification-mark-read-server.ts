import "server-only";

import { after } from "next/server";
import { markAllChangelogReadForUserServer } from "@/lib/changelog/mark-all-changelog-read-server";
import {
  markAllConversationsReadDbForUserServer,
  syncAllConversationsReadExternalServer,
} from "@/lib/contact-messages/mark-all-conversations-read-server";
import {
  markConversationReadDbServer,
  syncConversationReadExternalServer,
} from "@/lib/contact-messages/mark-conversation-read-server";
import {
  markUnifiedInboxConversationReadDbServer,
  resolveInboxChannelConnections,
  syncUnifiedInboxConversationReadExternalServer,
} from "@/lib/contact-messages/mark-unified-conversation-read-server";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { conversationChannelForRead } from "@/lib/contact-messages/unified-inbox-merge";
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
import { loadNotificationAccessContext } from "@/lib/notifications/notification-access-context";
import {
  isNotificationModuleVisibleForUser,
} from "@/lib/notifications/notification-module-permissions";
import {
  dismissAccountingNotification,
  dismissAllAccountingNotifications,
  isAccountingNotificationModule,
} from "@/lib/notifications/notification-accounting-server";
import {
  dismissAllStaffTodoNotifications,
  dismissStaffTodoNotification,
  isStaffTodoNotificationModule,
} from "@/lib/notifications/notification-staff-todos-server";
import {
  dismissAllStaffContractSignedNotifications,
  dismissStaffContractSignedNotification,
} from "@/lib/notifications/notification-staff-contract-server";
import {
  dismissAllStaffDisplayTimeRequestNotifications,
  dismissStaffDisplayTimeRequestNotification,
} from "@/lib/notifications/notification-staff-display-time-request-server";
import {
  dismissAllStaffInviteResponseNotifications,
  dismissStaffInviteResponseNotification,
  isStaffInviteResponseModule,
} from "@/lib/notifications/notification-staff-invite-server";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { REVIEW_PLATFORMS } from "@/lib/constants/review-platforms";
import { isContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
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
  const { access, shiftScope } = await loadNotificationAccessContext(sb, {
    restaurantId,
    userId,
  });
  if (!isNotificationModuleVisibleForUser(module, access)) {
    return { ok: false, error: "forbidden" };
  }

  switch (module) {
    case "messages": {
      if (!itemId) {
        const all = await markAllConversationsReadDbForUserServer(admin, {
          restaurantId,
          userId,
        });
        if (all.error) return { ok: false, error: all.error };
        after(() =>
          syncAllConversationsReadExternalServer(admin, all.marks),
        );
        return { ok: true };
      }
      const contactId = itemId ?? meta?.contactId;
      if (!contactId) {
        return { ok: false, error: "invalid_request" };
      }

      if (isLinkedContactId(contactId)) {
        const channelConnections = await resolveInboxChannelConnections(
          admin,
          restaurantId,
        );
        const result = await markUnifiedInboxConversationReadDbServer(admin, {
          restaurantId,
          userId,
          conversationKey: contactId,
          channelConnections,
        });
        if (result.error) return { ok: false, error: result.error };
        after(() =>
          syncUnifiedInboxConversationReadExternalServer(admin, result.marks),
        );
        return { ok: true };
      }

      const platformRaw =
        meta?.platform ?? conversationChannelForRead(contactId);
      if (!isContactMessagePlatform(platformRaw)) {
        return { ok: false, error: "invalid_request" };
      }
      const markParams = {
        restaurantId,
        userId,
        conversationKey: contactId,
        platform: platformRaw,
      };
      const result = await markConversationReadDbServer(admin, markParams);
      if (result.error) return { ok: false, error: result.error };
      after(() => syncConversationReadExternalServer(admin, markParams));
      return { ok: true };
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
          scope: shiftScope,
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

    case "accounting_quotation":
    case "accounting_invoice":
    case "accounting_voucher": {
      if (!isAccountingNotificationModule(module)) {
        return { ok: false, error: "invalid_module" };
      }
      if (!itemId) {
        const all = await dismissAllAccountingNotifications(admin, {
          restaurantId,
          userId,
          module,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const documentId = itemId ?? meta?.documentId;
      if (!documentId) return { ok: false, error: "invalid_request" };
      const result = await dismissAccountingNotification(sb, {
        restaurantId,
        userId,
        documentId,
        module,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "staff_todo_completed":
    case "staff_todo_deferred": {
      if (!isStaffTodoNotificationModule(module)) {
        return { ok: false, error: "invalid_module" };
      }
      if (!itemId) {
        const all = await dismissAllStaffTodoNotifications(sb, {
          restaurantId,
          userId,
          module,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const logEntryId = itemId ?? meta?.logEntryId;
      if (!logEntryId) return { ok: false, error: "invalid_request" };
      const result = await dismissStaffTodoNotification(sb, {
        restaurantId,
        userId,
        logEntryId,
        module,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "staff_contract_signed": {
      if (!itemId) {
        const all = await dismissAllStaffContractSignedNotifications(sb, {
          restaurantId,
          userId,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const contractId = itemId ?? meta?.contractId;
      if (!contractId) return { ok: false, error: "invalid_request" };
      const result = await dismissStaffContractSignedNotification(sb, {
        restaurantId,
        userId,
        contractId,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "staff_display_time_request": {
      if (!itemId) {
        const all = await dismissAllStaffDisplayTimeRequestNotifications(sb, {
          restaurantId,
          userId,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const requestId = itemId ?? meta?.requestId;
      if (!requestId) return { ok: false, error: "invalid_request" };
      const result = await dismissStaffDisplayTimeRequestNotification(sb, {
        restaurantId,
        userId,
        requestId,
      });
      return result.error ? { ok: false, error: result.error } : { ok: true };
    }

    case "staff_invite_accepted":
    case "staff_invite_declined": {
      if (!isStaffInviteResponseModule(module)) {
        return { ok: false, error: "invalid_module" };
      }
      if (!itemId) {
        const all = await dismissAllStaffInviteResponseNotifications(sb, {
          restaurantId,
          userId,
          module,
        });
        return all.error ? { ok: false, error: all.error } : { ok: true };
      }
      const inviteId = itemId ?? meta?.inviteId;
      if (!inviteId) return { ok: false, error: "invalid_request" };
      const result = await dismissStaffInviteResponseNotification(sb, {
        restaurantId,
        userId,
        inviteId,
        module,
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
