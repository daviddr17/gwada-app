import "server-only";

import { LEXOFFICE_API_BASE } from "@/lib/integrations/lexoffice-api";
import type { AccountingSalesDocumentInput } from "@/lib/types/accounting";
import { buildVoucherPeriodIntroduction } from "@/lib/accounting/accounting-voucher-date";
import { fetchContactLexofficeLinkForContact } from "@/lib/supabase/contact-lexoffice-links-db";
import { fetchRestaurantLexofficeApiKey } from "@/lib/supabase/restaurant-lexoffice-integration-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LEXWARE_APP_BASE = "https://app.lexware.de";

type LexofficeCreateResponse = {
  id: string;
  version?: number;
  resourceUri?: string;
};

type LexofficeSalesVoucher = {
  id: string;
  version?: number;
  voucherStatus?: string;
  voucherNumber?: string;
};

function voucherDateIso(dateYmd: string): string {
  return `${dateYmd}T12:00:00.000Z`;
}

function mapTaxType(taxMode: AccountingSalesDocumentInput["taxMode"]): string {
  if (taxMode === "gross") return "gross";
  if (taxMode === "vatfree") return "vatfree";
  return "net";
}

function mapLineItems(input: AccountingSalesDocumentInput) {
  const taxType = mapTaxType(input.taxMode);
  return input.lineItems
    .filter((line) => line.type !== "text" || line.name.trim())
    .map((line) => {
      if (line.type === "text") {
        return {
          type: "text",
          name: line.name,
          description: line.description ?? undefined,
        };
      }
      const unitPrice =
        taxType === "gross"
          ? {
              currency: input.currency,
              grossAmount: line.unitPrice,
              taxRatePercentage: line.taxRatePercent,
            }
          : {
              currency: input.currency,
              netAmount: line.unitPrice,
              taxRatePercentage: line.taxRatePercent,
            };
      return {
        type: "custom",
        name: line.name,
        description: line.description ?? undefined,
        quantity: line.quantity,
        unitName: line.unitName,
        unitPrice,
        discountPercentage: line.discountPercent,
      };
    });
}

async function resolveLexofficeAddress(
  restaurantId: string,
  input: AccountingSalesDocumentInput,
): Promise<Record<string, unknown>> {
  if (input.lexofficeContactId) {
    return { contactId: input.lexofficeContactId };
  }
  if (input.recipientType === "contact" && input.contactId) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      throw new Error("Server-Konfiguration fehlt.");
    }
    const link = await fetchContactLexofficeLinkForContact(
      admin,
      restaurantId,
      input.contactId,
    );
    if (link?.lexoffice_contact_id) {
      return { contactId: link.lexoffice_contact_id };
    }
  }
  const r = input.recipient;
  return {
    name: r.name,
    supplement: r.supplement ?? undefined,
    street: r.street ?? undefined,
    city: r.city ?? undefined,
    zip: r.zip ?? undefined,
    countryCode: r.countryCode ?? "DE",
  };
}

function buildSalesVoucherBody(input: AccountingSalesDocumentInput) {
  return {
    archived: false,
    voucherDate: voucherDateIso(input.voucherDate),
    address: {} as Record<string, unknown>,
    lineItems: mapLineItems(input),
    totalPrice: { currency: input.currency },
    taxConditions: { taxType: mapTaxType(input.taxMode) },
    shippingConditions: input.deliveryDate
      ? {
          shippingType: "delivery",
          shippingDate: voucherDateIso(input.deliveryDate),
        }
      : { shippingType: "none" },
    title: input.title ?? undefined,
    introduction:
      buildVoucherPeriodIntroduction({
        voucherDateKind: input.voucherDateKind ?? "date",
        voucherPeriodStart: input.voucherPeriodStart ?? null,
        voucherPeriodEnd: input.voucherPeriodEnd ?? null,
        introduction: input.introduction,
      }) ?? undefined,
    remark: input.remark ?? undefined,
  };
}

async function lexofficeAuthorizedFetch<T>(
  restaurantId: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) {
    return { ok: false, error: "Lexware ist nicht verbunden." };
  }

  let res: Response;
  try {
    res = await fetch(`${LEXOFFICE_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: text || `Lexware API (${res.status})`,
    };
  }

  const data = (await res.json()) as T;
  return { ok: true, data };
}

export type LexofficeCreatedSalesDocument = {
  id: string;
  version: number | null;
  voucherNumber: string | null;
  voucherStatus: string;
  editUrl: string;
};

export async function createLexofficeCreditNote(
  restaurantId: string,
  input: AccountingSalesDocumentInput,
  opts?: {
    precedingExternalId?: string | null;
    finalize?: boolean;
  },
): Promise<LexofficeCreatedSalesDocument> {
  const body = buildSalesVoucherBody(input);
  body.address = await resolveLexofficeAddress(restaurantId, input);

  const qs = new URLSearchParams();
  if (opts?.precedingExternalId?.trim()) {
    qs.set("precedingSalesVoucherId", opts.precedingExternalId.trim());
  }
  if (opts?.finalize ?? input.finalizeOnCreate) {
    qs.set("finalize", "true");
  }
  const query = qs.toString() ? `?${qs}` : "";

  const created = await lexofficeAuthorizedFetch<LexofficeCreateResponse>(
    restaurantId,
    `/v1/credit-notes${query}`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!created.ok) {
    throw new Error(created.error);
  }

  const detail = await lexofficeAuthorizedFetch<LexofficeSalesVoucher>(
    restaurantId,
    `/v1/credit-notes/${created.data.id}`,
    { method: "GET" },
  );

  const voucher = detail.ok ? detail.data : null;

  return {
    id: created.data.id,
    version: created.data.version ?? voucher?.version ?? null,
    voucherNumber: voucher?.voucherNumber ?? null,
    voucherStatus: voucher?.voucherStatus ?? "draft",
    editUrl: `${LEXWARE_APP_BASE}/permalink/credit-notes/edit/${created.data.id}`,
  };
}

export async function fetchLexofficeCreditNoteFile(
  restaurantId: string,
  externalId: string,
  format: "pdf" | "xml" = "pdf",
): Promise<
  | { ok: true; buffer: Buffer; contentType: string; filename: string }
  | { ok: false; error: string }
> {
  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) {
    return { ok: false, error: "Lexware ist nicht verbunden." };
  }

  const accept = format === "pdf" ? "application/pdf" : "application/xml";

  let res: Response;
  try {
    res = await fetch(
      `${LEXOFFICE_API_BASE}/v1/credit-notes/${externalId}/file`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: accept,
        },
        cache: "no-store",
      },
    );
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: text || `Lexware API (${res.status})`,
    };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = format === "pdf" ? "pdf" : "xml";
  return {
    ok: true,
    buffer,
    contentType: accept,
    filename: `Korrektur-${externalId.slice(0, 8)}.${ext}`,
  };
}

async function createLexofficeSalesDocument(
  restaurantId: string,
  input: AccountingSalesDocumentInput,
  kind: "invoices" | "quotations",
): Promise<LexofficeCreatedSalesDocument> {
  const body = buildSalesVoucherBody(input);
  body.address = await resolveLexofficeAddress(restaurantId, input);

  const finalize = input.finalizeOnCreate ? "?finalize=true" : "";
  const created = await lexofficeAuthorizedFetch<LexofficeCreateResponse>(
    restaurantId,
    `/v1/${kind}${finalize}`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!created.ok) {
    throw new Error(created.error);
  }

  const detail = await lexofficeAuthorizedFetch<LexofficeSalesVoucher>(
    restaurantId,
    `/v1/${kind}/${created.data.id}`,
    { method: "GET" },
  );

  const voucher = detail.ok ? detail.data : null;
  const editPath =
    kind === "invoices"
      ? `/permalink/invoices/edit/${created.data.id}`
      : `/permalink/quotations/edit/${created.data.id}`;

  return {
    id: created.data.id,
    version: created.data.version ?? voucher?.version ?? null,
    voucherNumber: voucher?.voucherNumber ?? null,
    voucherStatus: voucher?.voucherStatus ?? "draft",
    editUrl: `${LEXWARE_APP_BASE}${editPath}`,
  };
}

export async function createLexofficeInvoice(
  restaurantId: string,
  input: AccountingSalesDocumentInput,
): Promise<LexofficeCreatedSalesDocument> {
  return createLexofficeSalesDocument(restaurantId, input, "invoices");
}

export async function createLexofficeQuotation(
  restaurantId: string,
  input: AccountingSalesDocumentInput,
): Promise<LexofficeCreatedSalesDocument> {
  const bodyInput = {
    ...input,
    expirationDate:
      input.expirationDate ??
      input.dueDate ??
      input.voucherDate,
  };
  return createLexofficeSalesDocument(restaurantId, bodyInput, "quotations");
}
