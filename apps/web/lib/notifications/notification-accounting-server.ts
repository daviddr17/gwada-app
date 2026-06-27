import "server-only";

import {
  isSelfOriginatedNotification,
} from "@/lib/notifications/notification-self-origin";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { SupabaseClient } from "@supabase/supabase-js";

const ACCOUNTING_NOTIFICATION_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export type AccountingNotificationModuleId =
  | "accounting_quotation"
  | "accounting_invoice"
  | "accounting_voucher";

function recipientLabelFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as Record<string, unknown>;
  for (const key of ["companyName", "name", "displayName", "contactName"]) {
    const value = s[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function formatAmount(amount: unknown, currency: unknown): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const cur = typeof currency === "string" && currency.trim() ? currency : "EUR";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: cur,
  }).format(amount);
}

async function fetchDismissedDocumentIds(
  sb: SupabaseClient,
  params: {
    profileId: string;
    restaurantId: string;
    module: AccountingNotificationModuleId;
  },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_accounting_notification_dismissals")
    .select("document_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module);

  return new Set(
    (data ?? []).map((row) => (row as { document_id: string }).document_id),
  );
}

async function loadQuotationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    dismissed: Set<string>;
    limit: number;
  },
) {
  const since = new Date(
    Date.now() - ACCOUNTING_NOTIFICATION_LOOKBACK_MS,
  ).toISOString();

  const { data, error } = await sb
    .from("accounting_quotations")
    .select(
      "id, voucher_number, title, recipient_snapshot, totals, currency, created_at, created_by, source",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("source", "gwada")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(params.limit, 5), 100));

  if (error) {
    console.warn("[gwada] accounting quotation bell", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const r = row as {
        id: string;
        voucher_number: string | null;
        title: string | null;
        recipient_snapshot: unknown;
        totals: { gross?: number } | null;
        currency: string;
        created_at: string;
        created_by: string | null;
      };
      return r;
    })
    .filter((r) => !params.dismissed.has(r.id))
    .filter((r) => Boolean(r.created_by))
    .filter(
      (r) => !isSelfOriginatedNotification(params.userId, r.created_by),
    );
}

async function loadInvoiceItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    dismissed: Set<string>;
    limit: number;
  },
) {
  const since = new Date(
    Date.now() - ACCOUNTING_NOTIFICATION_LOOKBACK_MS,
  ).toISOString();

  const { data, error } = await sb
    .from("accounting_invoices")
    .select(
      "id, voucher_number, title, recipient_snapshot, totals, currency, created_at, created_by, source",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("source", "gwada")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(params.limit, 5), 100));

  if (error) {
    console.warn("[gwada] accounting invoice bell", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => row as {
      id: string;
      voucher_number: string | null;
      title: string | null;
      recipient_snapshot: unknown;
      totals: { gross?: number } | null;
      currency: string;
      created_at: string;
      created_by: string | null;
    })
    .filter((r) => !params.dismissed.has(r.id))
    .filter((r) => Boolean(r.created_by))
    .filter(
      (r) => !isSelfOriginatedNotification(params.userId, r.created_by),
    );
}

async function loadVoucherItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    dismissed: Set<string>;
    limit: number;
  },
) {
  const since = new Date(
    Date.now() - ACCOUNTING_NOTIFICATION_LOOKBACK_MS,
  ).toISOString();

  const { data, error } = await sb
    .from("accounting_vouchers")
    .select(
      "id, voucher_number, contact_name, total_gross_amount, currency, created_at, created_by, source",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("source", "gwada")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(params.limit, 5), 100));

  if (error) {
    console.warn("[gwada] accounting voucher bell", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => row as {
      id: string;
      voucher_number: string | null;
      contact_name: string | null;
      total_gross_amount: number;
      currency: string;
      created_at: string;
      created_by: string | null;
    })
    .filter((r) => !params.dismissed.has(r.id))
    .filter((r) => Boolean(r.created_by))
    .filter(
      (r) => !isSelfOriginatedNotification(params.userId, r.created_by),
    );
}

function mapQuotationToBellItem(row: {
  id: string;
  voucher_number: string | null;
  title: string | null;
  recipient_snapshot: unknown;
  totals: { gross?: number } | null;
  currency: string;
  created_at: string;
}) {
  const recipient =
    recipientLabelFromSnapshot(row.recipient_snapshot) ?? "Empfänger";
  const number = row.voucher_number?.trim();
  const amount = formatAmount(row.totals?.gross, row.currency);
  const subtitleParts = [
    number ? `Nr. ${number}` : null,
    amount,
    recipient !== "Empfänger" ? recipient : null,
  ].filter(Boolean);
  return {
    id: row.id,
    title: row.title?.trim() || "Neues Angebot",
    subtitle: subtitleParts.join(" · ") || recipient,
    href: "/dashboard/buchfuehrung/angebote",
    at: row.created_at,
    meta: { documentId: row.id },
  };
}

function mapInvoiceToBellItem(row: {
  id: string;
  voucher_number: string | null;
  title: string | null;
  recipient_snapshot: unknown;
  totals: { gross?: number } | null;
  currency: string;
  created_at: string;
}) {
  const recipient =
    recipientLabelFromSnapshot(row.recipient_snapshot) ?? "Empfänger";
  const number = row.voucher_number?.trim();
  const amount = formatAmount(row.totals?.gross, row.currency);
  const subtitleParts = [
    number ? `Nr. ${number}` : null,
    amount,
    recipient !== "Empfänger" ? recipient : null,
  ].filter(Boolean);
  return {
    id: row.id,
    title: row.title?.trim() || "Neue Rechnung",
    subtitle: subtitleParts.join(" · ") || recipient,
    href: "/dashboard/buchfuehrung/rechnungen",
    at: row.created_at,
    meta: { documentId: row.id },
  };
}

function mapVoucherToBellItem(row: {
  id: string;
  voucher_number: string | null;
  contact_name: string | null;
  total_gross_amount: number;
  currency: string;
  created_at: string;
}) {
  const contact = row.contact_name?.trim() || "Beleg";
  const number = row.voucher_number?.trim();
  const amount = formatAmount(row.total_gross_amount, row.currency);
  const subtitleParts = [
    number ? `Nr. ${number}` : null,
    amount,
    contact !== "Beleg" ? contact : null,
  ].filter(Boolean);
  return {
    id: row.id,
    title: "Neuer Beleg",
    subtitle: subtitleParts.join(" · ") || contact,
    href: "/dashboard/buchfuehrung/belege",
    at: row.created_at,
    meta: { documentId: row.id },
  };
}

export async function loadAccountingNotificationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: AccountingNotificationModuleId;
    limit?: number;
  },
) {
  const limit = params.limit ?? 5;
  const dismissed = await fetchDismissedDocumentIds(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    module: params.module,
  });

  let rows: Array<Record<string, unknown>> = [];
  if (params.module === "accounting_quotation") {
    rows = await loadQuotationItems(sb, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      dismissed,
      limit,
    });
  } else if (params.module === "accounting_invoice") {
    rows = await loadInvoiceItems(sb, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      dismissed,
      limit,
    });
  } else {
    rows = await loadVoucherItems(sb, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      dismissed,
      limit,
    });
  }

  const items =
    params.module === "accounting_quotation"
      ? rows.slice(0, limit).map((r) =>
          mapQuotationToBellItem(
            r as Parameters<typeof mapQuotationToBellItem>[0],
          ),
        )
      : params.module === "accounting_invoice"
        ? rows.slice(0, limit).map((r) =>
            mapInvoiceToBellItem(
              r as Parameters<typeof mapInvoiceToBellItem>[0],
            ),
          )
        : rows.slice(0, limit).map((r) =>
            mapVoucherToBellItem(
              r as Parameters<typeof mapVoucherToBellItem>[0],
            ),
          );

  return { items, totalCount: rows.length };
}

export async function dismissAccountingNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    documentId: string;
    module: AccountingNotificationModuleId;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_accounting_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        document_id: params.documentId,
        module: params.module,
      },
      { onConflict: "profile_id,restaurant_id,document_id,module" },
    );

  return { error: error?.message ?? null };
}

export async function dismissAllAccountingNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: AccountingNotificationModuleId;
  },
): Promise<{ error: string | null }> {
  const { items } = await loadAccountingNotificationItems(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    module: params.module,
    limit: 500,
  });

  if (items.length === 0) return { error: null };

  const rows = items.map((item) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    document_id: item.id,
    module: params.module,
  }));

  const { error } = await sb
    .from("restaurant_accounting_notification_dismissals")
    .upsert(rows, {
      onConflict: "profile_id,restaurant_id,document_id,module",
    });

  return { error: error?.message ?? null };
}

export function isAccountingNotificationModule(
  module: NotificationModuleId,
): module is AccountingNotificationModuleId {
  return (
    module === "accounting_quotation" ||
    module === "accounting_invoice" ||
    module === "accounting_voucher"
  );
}
