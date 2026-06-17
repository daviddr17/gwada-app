import "server-only";

import { fetchMessagesUnreadSummary } from "@/lib/contact-messages/unread-summary-server";
import { loadDashboardReviewsSummary } from "@/lib/dashboard/load-dashboard-reviews-summary";
import { loadInventoryLowStockBellSummary } from "@/lib/notifications/notification-inventory-server";
import {
  NOTIFICATION_MODULES,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import { loadReservationNotificationItems } from "@/lib/notifications/notification-reservations-server";
import {
  loadStaffShiftEndBellSummary,
  loadStaffShiftStartBellSummary,
} from "@/lib/notifications/notification-staff-shift-server";
import {
  isInAppModuleEnabled,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences";
import type {
  NotificationItem,
  NotificationModuleSummary,
  NotificationSummary,
} from "@/lib/notifications/notification-types";
import { loadNotificationPreferences } from "@/lib/supabase/user-restaurant-notification-preferences-db";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import type { SupabaseClient } from "@supabase/supabase-js";

const BELL_ITEMS_PER_MODULE = 5;

async function fetchUnreadChangelogItems(
  sb: SupabaseClient,
  userId: string,
): Promise<NotificationItem[]> {
  const { data: entries } = await sb
    .from("platform_changelog_entries")
    .select("id, title, published_at, version")
    .eq("audience", "customers")
    .not("approved_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(20);

  if (!entries?.length) return [];

  const ids = entries.map((e) => (e as { id: string }).id);
  const { data: reads } = await sb
    .from("platform_changelog_reads")
    .select("changelog_entry_id")
    .eq("profile_id", userId)
    .in("changelog_entry_id", ids);

  const readIds = new Set(
    (reads ?? []).map(
      (r) => (r as { changelog_entry_id: string }).changelog_entry_id,
    ),
  );

  return entries
    .filter((e) => !readIds.has((e as { id: string }).id))
    .slice(0, BELL_ITEMS_PER_MODULE)
    .map((e) => {
      const row = e as {
        id: string;
        title: string;
        published_at: string;
        version: string | null;
      };
      return {
        id: row.id,
        title: row.title,
        subtitle: row.version ? `Version ${row.version}` : null,
        href: "/changelog",
        at: row.published_at,
      };
    });
}

async function buildMessagesModule(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    whatsappConnected: boolean;
    emailConnected: boolean;
  },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES.messages;

  const summary = await fetchMessagesUnreadSummary(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    whatsappConnected: params.whatsappConnected,
    emailConnected: params.emailConnected,
    includeInboxConversations: false,
  });

  const items: NotificationItem[] = summary.unread.map((row) => ({
    id: row.contactId,
    title: row.contactName,
    subtitle: row.preview,
    href: row.href,
    at: row.lastAt,
    meta: { contactId: row.contactId, platform: row.platform },
  }));

  return {
    id: def.id,
    count: summary.total_unread,
    label: def.labelPlural,
    href: def.href,
    items,
  };
}

async function buildReviewsModule(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES.reviews;
  const summary = await loadDashboardReviewsSummary(
    params.restaurantId,
    params.userId,
    sb,
  );

  const items: NotificationItem[] = summary.recent
    .filter((r) => r.isUnread)
    .slice(0, BELL_ITEMS_PER_MODULE)
    .map((r) => ({
      id: r.id,
      title: r.authorName?.trim() || "Bewertung",
      subtitle:
        r.commentPreview ??
        `${"★".repeat(Math.round(r.rating))}${"☆".repeat(5 - Math.round(r.rating))}`,
      href: r.href,
      at: r.createdAt,
      meta: {
        platform: r.platform,
        reviewId: r.id,
        ...(r.contactId ? { contactId: r.contactId } : {}),
      },
    }));

  return {
    id: def.id,
    count: summary.unreadRecentCount,
    label: def.labelPlural,
    href: def.href,
    items,
  };
}

async function buildReservationModule(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module:
      | "reservations_pending"
      | "reservations_change_request"
      | "reservations_cancellation";
  },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES[params.module];
  const { items, totalCount } = await loadReservationNotificationItems(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    module: params.module,
    limit: BELL_ITEMS_PER_MODULE,
  });

  return {
    id: def.id,
    count: totalCount,
    label: def.labelPlural,
    href: def.href,
    items,
  };
}

async function buildStaffShiftModule(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: "staff_shift_start" | "staff_shift_end";
  },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES[params.module];
  const summary =
    params.module === "staff_shift_start"
      ? await loadStaffShiftStartBellSummary(sb, {
          restaurantId: params.restaurantId,
          userId: params.userId,
          limit: BELL_ITEMS_PER_MODULE,
        })
      : await loadStaffShiftEndBellSummary(sb, {
          restaurantId: params.restaurantId,
          userId: params.userId,
          limit: BELL_ITEMS_PER_MODULE,
        });

  return {
    id: def.id,
    count: summary.totalCount,
    label: def.labelPlural,
    href: def.href,
    items: summary.items,
  };
}

async function buildInventoryLowStockModule(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES.inventory_low_stock;
  const { items, totalCount } = await loadInventoryLowStockBellSummary(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    limit: BELL_ITEMS_PER_MODULE,
  });

  return {
    id: def.id,
    count: totalCount,
    label: def.labelPlural,
    href: def.href,
    items,
  };
}

async function buildChangelogModule(
  sb: SupabaseClient,
  userId: string,
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES.changelog;
  const items = await fetchUnreadChangelogItems(sb, userId);

  return {
    id: def.id,
    count: items.length,
    label: def.labelPlural,
    href: def.href,
    items,
  };
}

const MODULE_BUILDERS: Record<
  NotificationModuleId,
  (
    ctx: ModuleBuildContext,
  ) => Promise<NotificationModuleSummary>
> = {
  messages: (ctx) => buildMessagesModule(ctx.admin, ctx),
  reviews: (ctx) => buildReviewsModule(ctx.sb, ctx),
  changelog: (ctx) => buildChangelogModule(ctx.sb, ctx.userId),
  reservations_pending: (ctx) =>
    buildReservationModule(ctx.sb, { ...ctx, module: "reservations_pending" }),
  reservations_change_request: (ctx) =>
    buildReservationModule(ctx.sb, {
      ...ctx,
      module: "reservations_change_request",
    }),
  reservations_cancellation: (ctx) =>
    buildReservationModule(ctx.sb, {
      ...ctx,
      module: "reservations_cancellation",
    }),
  staff_shift_start: (ctx) =>
    buildStaffShiftModule(ctx.sb, { ...ctx, module: "staff_shift_start" }),
  staff_shift_end: (ctx) =>
    buildStaffShiftModule(ctx.sb, { ...ctx, module: "staff_shift_end" }),
  inventory_low_stock: (ctx) => buildInventoryLowStockModule(ctx.sb, ctx),
};

type ModuleBuildContext = {
  sb: SupabaseClient;
  admin: SupabaseClient;
  restaurantId: string;
  userId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
};

export async function fetchNotificationSummaryServer(
  sb: SupabaseClient,
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    whatsappConnected?: boolean;
    emailConnected?: boolean;
  },
): Promise<NotificationSummary> {
  const preferences = await loadNotificationPreferences(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
  });

  let whatsappConnected = params.whatsappConnected;
  let emailConnected = params.emailConnected;
  if (whatsappConnected === undefined || emailConnected === undefined) {
    const [wahaConfig, imapCreds] = await Promise.all([
      getWahaServerConfigAdmin(),
      resolveRestaurantImapCredentials(admin, params.restaurantId),
    ]);
    whatsappConnected = Boolean(wahaConfig);
    emailConnected = Boolean(imapCreds);
  }

  const ctx: ModuleBuildContext = {
    sb,
    admin,
    restaurantId: params.restaurantId,
    userId: params.userId,
    whatsappConnected: whatsappConnected ?? false,
    emailConnected: emailConnected ?? false,
  };

  const enabledModuleIds = (
    Object.keys(MODULE_BUILDERS) as NotificationModuleId[]
  ).filter((moduleId) => isInAppModuleEnabled(preferences, moduleId));

  const built = await Promise.all(
    enabledModuleIds.map((moduleId) => MODULE_BUILDERS[moduleId](ctx)),
  );
  const modules = built.filter((m) => m.count > 0);

  const totalCount = modules.reduce((sum, m) => sum + m.count, 0);

  return { totalCount, modules, preferences };
}
