import "server-only";

import { fetchMessagesUnreadSummary } from "@/lib/contact-messages/unread-summary-server";
import { loadDashboardReservationSummaryServer } from "@/lib/dashboard/load-dashboard-reservation-summary-server";
import { loadDashboardReviewsSummary } from "@/lib/dashboard/load-dashboard-reviews-summary";
import {
  NOTIFICATION_MODULES,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
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
import { isUnconfirmedReservation } from "@/lib/reservations/unconfirmed-reservations";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import type { SupabaseClient } from "@supabase/supabase-js";

const BELL_ITEMS_PER_MODULE = 5;

async function fetchDismissedReservationIds(
  sb: SupabaseClient,
  params: { profileId: string; restaurantId: string },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_reservation_notification_dismissals")
    .select("reservation_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId);

  return new Set(
    (data ?? []).map((row) => (row as { reservation_id: string }).reservation_id),
  );
}

async function fetchUnreadChangelogItems(
  sb: SupabaseClient,
  userId: string,
): Promise<NotificationItem[]> {
  const { data: entries } = await sb
    .from("platform_changelog_entries")
    .select("id, title, published_at, version")
    .eq("audience", "customers")
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
      meta: { platform: r.platform, reviewId: r.id },
    }));

  return {
    id: def.id,
    count: summary.unreadRecentCount,
    label: def.labelPlural,
    href: def.href,
    items,
  };
}

async function buildReservationsModule(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES.reservations;
  const [summary, dismissed] = await Promise.all([
    loadDashboardReservationSummaryServer(sb, params.restaurantId),
    fetchDismissedReservationIds(sb, {
      profileId: params.userId,
      restaurantId: params.restaurantId,
    }),
  ]);

  const pending = summary.recent.filter(
    (r) => r.unconfirmed && !dismissed.has(r.id),
  );

  const items: NotificationItem[] = pending
    .slice(0, BELL_ITEMS_PER_MODULE)
    .map((r) => ({
      id: r.id,
      title: r.guestLabel,
      subtitle: `${r.partySize} Gäste · ${r.statusName}`,
      href: r.href,
      at: r.startsAt,
      meta: { reservationId: r.id },
    }));

  return {
    id: def.id,
    count: pending.length,
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
  reservations: (ctx) => buildReservationsModule(ctx.sb, ctx),
  changelog: (ctx) => buildChangelogModule(ctx.sb, ctx.userId),
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

  const modules: NotificationModuleSummary[] = [];

  for (const moduleId of Object.keys(MODULE_BUILDERS) as NotificationModuleId[]) {
    if (!isInAppModuleEnabled(preferences, moduleId)) continue;
    const built = await MODULE_BUILDERS[moduleId](ctx);
    if (built.count > 0) {
      modules.push(built);
    }
  }

  const totalCount = modules.reduce((sum, m) => sum + m.count, 0);

  return { totalCount, modules, preferences };
}
