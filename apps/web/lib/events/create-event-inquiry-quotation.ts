import "server-only";

import { createAccountingQuotation } from "@/lib/accounting/accounting-quotations-server";
import { computeLineAmount } from "@/lib/accounting/compute-line-totals";
import { ACCOUNTING_DEFAULT_CURRENCY } from "@/lib/accounting/accounting-locale";
import { formatGermanYmd } from "@/lib/accounting/accounting-voucher-date";
import { restaurantTodayYmd, restaurantZonedDateKey } from "@/lib/restaurant/restaurant-timezone";
import type { EventPackage } from "@/lib/events/event-package";
import {
  eventMenuQuoteLines,
  formatEventMenuNotes,
  type EventMenu,
  type EventMenuSelection,
} from "@/lib/events/event-menu";
import type { AccountingLineItem } from "@/lib/types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";

export function formatEventPackageNotes(packages: EventPackage[]): string | null {
  if (packages.length === 0) return null;
  return `Pakete: ${packages.map((pkg) => pkg.name).join(", ")}`;
}

export function formatEventInquiryNotes(params: {
  occasion: string;
  message: string;
  packages: EventPackage[];
  menu: EventMenu | null;
  menuSelection: EventMenuSelection | null;
  partySize: number;
}): string | null {
  const parts: string[] = [];
  if (params.occasion) parts.push(`Anlass: ${params.occasion}`);
  if (params.menu && params.menuSelection) {
    parts.push(formatEventMenuNotes(params.menu, params.menuSelection, params.partySize));
  }
  const packageNotes = formatEventPackageNotes(params.packages);
  if (packageNotes) parts.push(packageNotes);
  if (params.message) parts.push(params.message);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function toAccountingLine(
  line: {
    name: string;
    description: string | null;
    quantity: number;
    unitName: string;
    unitPrice: number;
  },
  index: number,
  taxRatePercent: number,
): AccountingLineItem {
  const item: AccountingLineItem = {
    id: crypto.randomUUID(),
    sortOrder: index,
    type: "custom",
    articleId: null,
    name: line.name,
    description: line.description,
    quantity: line.quantity,
    unitName: line.unitName,
    unitPrice: line.unitPrice,
    taxRatePercent,
    discountPercent: 0,
    lineAmount: 0,
  };
  return { ...item, lineAmount: computeLineAmount(item, "gross") };
}

export async function createEventInquiryQuotation(params: {
  sb: SupabaseClient;
  restaurantId: string;
  timezone: string;
  startsAtIso: string;
  partySize: number;
  packages: EventPackage[];
  menu: EventMenu | null;
  menuSelection: EventMenuSelection | null;
  guestFirstName: string;
  guestLastName: string;
  guestCompany: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  occasion: string;
  message: string;
}): Promise<string | null> {
  const menuLines =
    params.menu && params.menuSelection
      ? eventMenuQuoteLines(params.menu, params.menuSelection, params.partySize)
      : [];
  if (params.packages.length === 0 && menuLines.length === 0) return null;

  const recipientName =
    params.guestCompany?.trim() ||
    `${params.guestFirstName} ${params.guestLastName}`.trim() ||
    "Gast";
  const eventYmd = restaurantZonedDateKey(new Date(params.startsAtIso), params.timezone);
  const eventLabel = formatGermanYmd(eventYmd);
  const peopleLabel =
    params.partySize === 1 ? "1 Person" : `${params.partySize} Personen`;
  const introParts = [
    `${peopleLabel} am ${eventLabel}`,
    params.occasion ? `Anlass: ${params.occasion}` : null,
  ].filter((part): part is string => Boolean(part));

  const lineItems: AccountingLineItem[] = [];
  if (params.menu) {
    for (const line of menuLines) {
      lineItems.push(
        toAccountingLine(line, lineItems.length, params.menu.taxRatePercent),
      );
    }
  }
  for (const pkg of params.packages) {
    lineItems.push(
      toAccountingLine(
        {
          name: pkg.name,
          description: pkg.description || null,
          quantity: params.partySize,
          unitName: "Person",
          unitPrice: pkg.pricePerPerson,
        },
        lineItems.length,
        pkg.taxRatePercent,
      ),
    );
  }

  const result = await createAccountingQuotation(params.sb, {
    restaurantId: params.restaurantId,
    userId: null,
    input: {
      recipientType: "one_time",
      contactId: null,
      recipient: {
        name: recipientName,
        email: params.guestEmail,
        phone: params.guestPhone,
      },
      voucherDate: restaurantTodayYmd(params.timezone),
      deliveryDate: eventYmd,
      currency: ACCOUNTING_DEFAULT_CURRENCY,
      taxMode: "gross",
      lineItems,
      title: `Veranstaltungsanfrage ${eventLabel}`,
      introduction: introParts.join(" · "),
      remark: params.message || null,
      syncToLexoffice: false,
    },
  });

  if (!result.row) {
    console.warn("[gwada] event inquiry quotation", result.error);
    return null;
  }
  return result.row.id;
}
