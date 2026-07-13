import "server-only";

import { fetchMessagesUnreadSummary } from "@/lib/contact-messages/unread-summary-server";
import { loadDashboardReviewsSummary } from "@/lib/dashboard/load-dashboard-reviews-summary";
import { loadInventoryLowStockBellSummary } from "@/lib/notifications/notification-inventory-server";
import { loadAccountingNotificationItems } from "@/lib/notifications/notification-accounting-server";
import { loadStaffTodoNotificationItems } from "@/lib/notifications/notification-staff-todos-server";
import { loadStaffContractSignedNotificationItems } from "@/lib/notifications/notification-staff-contract-server";
import { loadStaffDisplayTimeRequestNotificationItems } from "@/lib/notifications/notification-staff-display-time-request-server";
import {
  loadStaffInviteResponseNotificationItems,
} from "@/lib/notifications/notification-staff-invite-server";
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
import {
  isNotificationModuleVisibleForUser,
} from "@/lib/notifications/notification-module-permissions";
import {
  loadNotificationAccessContext,
  type StaffShiftBellScope,
} from "@/lib/notifications/notification-access-context";
import type {
  NotificationItem,
  NotificationModuleSummary,
  NotificationSummary,
} from "@/lib/notifications/notification-types";
import { loadNotificationPreferences } from "@/lib/supabase/user-restaurant-notification-preferences-db";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { isMetaInboxConnected } from "@/lib/contact-messages/meta-inbox-auth-server";
import type { SupabaseClient } from "@supabase/supabase-js";

const BELL_ITEMS_PER_MODULE = 5;

async function fetchUnreadChangelogItems(
  sb: SupabaseClient,
  userId: string,
): Promise<{ items: NotificationItem[]; totalCount: number }> {
  const { data: entries } = await sb
    .from("platform_changelog_entries")
    .select("id, title, published_at, version")
    .eq("audience", "customers")
    .not("approved_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(20);

  if (!entries?.length) return { items: [], totalCount: 0 };

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

  const unread = entries.filter((e) => !readIds.has((e as { id: string }).id));

  return {
    totalCount: unread.length,
    items: unread.slice(0, BELL_ITEMS_PER_MODULE).map((e) => {
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
    }),
  };
}

async function buildMessagesModule(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    whatsappConnected: boolean;
    emailConnected: boolean;
    facebookConnected?: boolean;
    instagramConnected?: boolean;
  },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES.messages;

  const summary = await fetchMessagesUnreadSummary(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    whatsappConnected: params.whatsappConnected,
    emailConnected: params.emailConnected,
    facebookConnected: params.facebookConnected,
    instagramConnected: params.instagramConnected,
    includeInboxConversations: false,
  });

  const items: NotificationItem[] = summary.unread.map((row) => ({
    id: row.contactId,
    title: row.contactName,
    subtitle: row.preview,
    href: row.href,
    at: row.lastAt,
    meta: {
      contactId: row.contactId,
      platform: row.platform,
      ...(row.unreadHint ? { unreadHint: row.unreadHint } : {}),
    },
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
      subtitle: r.commentPreview ?? null,
      href: r.href,
      at: r.createdAt,
      meta: {
        platform: r.platform,
        reviewId: r.id,
        rating: String(r.rating),
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
    shiftScope: "team" | "own";
  },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES[params.module];
  const summary =
    params.module === "staff_shift_start"
      ? await loadStaffShiftStartBellSummary(sb, {
          restaurantId: params.restaurantId,
          userId: params.userId,
          limit: BELL_ITEMS_PER_MODULE,
          scope: params.shiftScope,
        })
      : await loadStaffShiftEndBellSummary(sb, {
          restaurantId: params.restaurantId,
          userId: params.userId,
          limit: BELL_ITEMS_PER_MODULE,
          scope: params.shiftScope,
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

async function buildAccountingModule(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module:
      | "accounting_quotation"
      | "accounting_invoice"
      | "accounting_voucher";
  },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES[params.module];
  const { items, totalCount } = await loadAccountingNotificationItems(sb, {
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

async function buildChangelogModule(
  sb: SupabaseClient,
  userId: string,
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES.changelog;
  const { items, totalCount } = await fetchUnreadChangelogItems(sb, userId);

  return {
    id: def.id,
    count: totalCount,
    label: def.labelPlural,
    href: def.href,
    items,
  };
}

async function buildStaffTodoModule(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: "staff_todo_completed" | "staff_todo_deferred";
  },
): Promise<NotificationModuleSummary> {
  const def = NOTIFICATION_MODULES[params.module];
  const { items, totalCount } = await loadStaffTodoNotificationItems(sb, {
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
    buildStaffShiftModule(ctx.sb, {
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      module: "staff_shift_start",
      shiftScope: ctx.shiftScope,
    }),
  staff_shift_end: (ctx) =>
    buildStaffShiftModule(ctx.sb, {
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      module: "staff_shift_end",
      shiftScope: ctx.shiftScope,
    }),
  inventory_low_stock: (ctx) => buildInventoryLowStockModule(ctx.sb, ctx),
  accounting_quotation: (ctx) =>
    buildAccountingModule(ctx.sb, {
      ...ctx,
      module: "accounting_quotation",
    }),
  accounting_invoice: (ctx) =>
    buildAccountingModule(ctx.sb, {
      ...ctx,
      module: "accounting_invoice",
    }),
  accounting_voucher: (ctx) =>
    buildAccountingModule(ctx.sb, {
      ...ctx,
      module: "accounting_voucher",
    }),
  staff_todo_completed: (ctx) =>
    buildStaffTodoModule(ctx.sb, {
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      module: "staff_todo_completed",
    }),
  staff_todo_deferred: (ctx) =>
    buildStaffTodoModule(ctx.sb, {
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      module: "staff_todo_deferred",
    }),
  staff_contract_signed: async (ctx) => {
    const def = NOTIFICATION_MODULES.staff_contract_signed;
    const items = await loadStaffContractSignedNotificationItems(ctx.sb, {
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
    });
    return {
      id: def.id,
      count: items.length,
      label: def.labelPlural,
      href: def.href,
      items,
    };
  },
  staff_display_time_request: async (ctx) => {
    const def = NOTIFICATION_MODULES.staff_display_time_request;
    const { items, totalCount } = await loadStaffDisplayTimeRequestNotificationItems(
      ctx.sb,
      {
        restaurantId: ctx.restaurantId,
        userId: ctx.userId,
        limit: BELL_ITEMS_PER_MODULE,
      },
    );
    return {
      id: def.id,
      count: totalCount,
      label: def.labelPlural,
      href: def.href,
      items,
    };
  },
  staff_invite_accepted: async (ctx) => {
    const def = NOTIFICATION_MODULES.staff_invite_accepted;
    const { items, totalCount } = await loadStaffInviteResponseNotificationItems(
      ctx.sb,
      {
        restaurantId: ctx.restaurantId,
        userId: ctx.userId,
        module: "staff_invite_accepted",
        limit: BELL_ITEMS_PER_MODULE,
      },
    );
    return {
      id: def.id,
      count: totalCount,
      label: def.labelPlural,
      href: def.href,
      items,
    };
  },
  staff_invite_declined: async (ctx) => {
    const def = NOTIFICATION_MODULES.staff_invite_declined;
    const { items, totalCount } = await loadStaffInviteResponseNotificationItems(
      ctx.sb,
      {
        restaurantId: ctx.restaurantId,
        userId: ctx.userId,
        module: "staff_invite_declined",
        limit: BELL_ITEMS_PER_MODULE,
      },
    );
    return {
      id: def.id,
      count: totalCount,
      label: def.labelPlural,
      href: def.href,
      items,
    };
  },
};

type ModuleBuildContext = {
  sb: SupabaseClient;
  admin: SupabaseClient;
  restaurantId: string;
  userId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
  shiftScope: StaffShiftBellScope;
};

export async function fetchNotificationSummaryServer(
  sb: SupabaseClient,
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    whatsappConnected?: boolean;
    emailConnected?: boolean;
    facebookConnected?: boolean;
    instagramConnected?: boolean;
  },
): Promise<NotificationSummary> {
  const preferences = await loadNotificationPreferences(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
  });

  const { access, shiftScope } = await loadNotificationAccessContext(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
  });

  let whatsappConnected = params.whatsappConnected;
  let emailConnected = params.emailConnected;
  let facebookConnected = params.facebookConnected;
  let instagramConnected = params.instagramConnected;
  if (
    whatsappConnected === undefined ||
    emailConnected === undefined ||
    facebookConnected === undefined ||
    instagramConnected === undefined
  ) {
    const [wahaConfig, imapCreds, fbConnected, igConnected] = await Promise.all([
      getWahaServerConfigAdmin(),
      resolveRestaurantImapCredentials(admin, params.restaurantId),
      facebookConnected === undefined
        ? isMetaInboxConnected(admin, params.restaurantId, "facebook")
        : Promise.resolve(facebookConnected),
      instagramConnected === undefined
        ? isMetaInboxConnected(admin, params.restaurantId, "instagram")
        : Promise.resolve(instagramConnected),
    ]);
    whatsappConnected = Boolean(wahaConfig);
    emailConnected = Boolean(imapCreds);
    facebookConnected = fbConnected;
    instagramConnected = igConnected;
  }

  const ctx: ModuleBuildContext = {
    sb,
    admin,
    restaurantId: params.restaurantId,
    userId: params.userId,
    whatsappConnected: whatsappConnected ?? false,
    emailConnected: emailConnected ?? false,
    facebookConnected: facebookConnected ?? false,
    instagramConnected: instagramConnected ?? false,
    shiftScope,
  };

  const enabledModuleIds = (
    Object.keys(MODULE_BUILDERS) as NotificationModuleId[]
  ).filter(
    (moduleId) =>
      isInAppModuleEnabled(preferences, moduleId) &&
      isNotificationModuleVisibleForUser(moduleId, access),
  );

  const built = await Promise.all(
    enabledModuleIds.map((moduleId) => MODULE_BUILDERS[moduleId](ctx)),
  );
  const modules = built.filter((m) => m.count > 0);

  const totalCount = modules.reduce((sum, m) => sum + m.count, 0);

  return { totalCount, modules, preferences };
}
