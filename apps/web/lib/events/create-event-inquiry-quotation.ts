import "server-only";

import { createAccountingQuotation } from "@/lib/accounting/accounting-quotations-server";
import { computeLineAmount } from "@/lib/accounting/compute-line-totals";
import { ACCOUNTING_DEFAULT_CURRENCY } from "@/lib/accounting/accounting-locale";
import { formatGermanYmd } from "@/lib/accounting/accounting-voucher-date";
import { restaurantTodayYmd, restaurantZonedDateKey } from "@/lib/restaurant/restaurant-timezone";
import type { EventPackage } from "@/lib/events/event-package";
import type { AccountingLineItem } from "@/lib/types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";

export function formatEventPackageNotes(packages: EventPackage[]): string | null {
  if (packages.length === 0) return null;
  return `Pakete: ${packages.map((pkg) => pkg.name).join(", ")}`;
}

export async function createEventInquiryQuotation(params: {
  sb: SupabaseClient;
  restaurantId: string;
  timezone: string;
  startsAtIso: string;
  partySize: number;
  packages: EventPackage[];
  guestFirstName: string;
  guestLastName: string;
  guestCompany: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  occasion: string;
  message: string;
}): Promise<string | null> {
  if (params.packages.length === 0) return null;

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

  const lineItems: AccountingLineItem[] = params.packages.map((pkg, index) => {
    const item: AccountingLineItem = {
      id: crypto.randomUUID(),
      sortOrder: index,
      type: "custom",
      articleId: null,
      name: pkg.name,
      description: pkg.description || null,
      quantity: params.partySize,
      unitName: "Person",
      unitPrice: pkg.pricePerPerson,
      taxRatePercent: pkg.taxRatePercent,
      discountPercent: 0,
      lineAmount: 0,
    };
    return { ...item, lineAmount: computeLineAmount(item, "gross") };
  });

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
