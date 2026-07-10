import "server-only";

import { fetchLexofficeJson } from "@/lib/integrations/lexoffice-api";
import { fetchLexofficeSalesDetail } from "@/lib/integrations/lexoffice-voucherlist";
import { fetchRestaurantLexofficeApiKey } from "@/lib/supabase/restaurant-lexoffice-integration-db";

function voucherDateIsoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T12:00:00.000+02:00`;
}

export async function createLexofficeDunningForInvoice(
  restaurantId: string,
  externalInvoiceId: string,
): Promise<
  | { ok: true; dunningId: string }
  | { ok: false; error: string }
> {
  const detailResult = await fetchLexofficeSalesDetail(
    restaurantId,
    "invoice",
    externalInvoiceId,
    undefined,
    { skipCache: true },
  );
  if (!detailResult.ok) {
    return { ok: false, error: detailResult.error };
  }

  const detail = detailResult.detail;
  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) {
    return { ok: false, error: "Lexware ist nicht verbunden." };
  }

  const body: Record<string, unknown> = {
    archived: false,
    voucherDate: voucherDateIsoToday(),
    address: detail.address ?? {},
    lineItems: detail.lineItems ?? [],
    totalPrice: detail.totalPrice ?? { currency: "EUR" },
    taxConditions: detail.taxConditions ?? { taxType: "net" },
    shippingConditions: detail.shippingConditions ?? { shippingType: "none" },
    title: "Mahnung",
    introduction:
      "Wir bitten Sie, den offenen Betrag unverzüglich zu begleichen.",
    remark:
      "Sollten Sie den Betrag bereits beglichen haben, betrachten Sie dieses Schreiben als gegenstandslos.",
  };

  const result = await fetchLexofficeJson<{ id?: string }>(
    apiKey,
    `/v1/dunnings?precedingSalesVoucherId=${encodeURIComponent(externalInvoiceId)}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!result.ok) return result;
  if (!result.data.id) {
    return { ok: false, error: "Lexware hat keine Mahnung angelegt." };
  }

  return { ok: true, dunningId: result.data.id };
}
