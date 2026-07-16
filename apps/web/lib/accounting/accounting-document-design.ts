import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ACCOUNTING_DOCUMENT_DESIGN,
  parseAccountingDocumentDesign,
  type AccountingDocumentDesign,
} from "@/lib/types/accounting-settings";
import { fetchRestaurantStammdatenFromDb } from "@/lib/supabase/restaurant-stammdaten-db";
import { RESTAURANT_PROFILE_IMAGES_BUCKET } from "@/lib/restaurant/restaurant-profile-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  legacyLexofficeFieldsFromConnectorSettings,
  parseConnectorSettings,
} from "@/lib/accounting/accounting-connector-settings";

export type AccountingCompanyBlock = {
  name: string;
  street: string;
  cityLine: string;
  country: string;
  phone: string;
  website: string;
  vatNumber: string;
  receiptFooter: string;
  /** Flache Zeilen für ZUGFeRD / Legacy. */
  lines: string[];
};

export type AccountingPdfRenderContext = {
  design: AccountingDocumentDesign;
  company: AccountingCompanyBlock;
  logo:
    | {
        base64: string;
        format: "JPEG" | "PNG";
        widthPx: number;
        heightPx: number;
      }
    | null;
};

function buildAddressLines(stammdaten: {
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}): string[] {
  const lines: string[] = [];
  if (stammdaten.street?.trim()) lines.push(stammdaten.street.trim());
  const cityLine = [stammdaten.postalCode, stammdaten.city]
    .filter((p) => p?.trim())
    .join(" ");
  if (cityLine) lines.push(cityLine);
  if (stammdaten.country?.trim()) lines.push(stammdaten.country.trim());
  return lines;
}

export function buildCompanyBlock(
  stammdaten: NonNullable<Awaited<ReturnType<typeof fetchRestaurantStammdatenFromDb>>>,
): AccountingCompanyBlock {
  const street = stammdaten.street?.trim() ?? "";
  const cityLine = [stammdaten.postalCode, stammdaten.city]
    .filter((p) => p?.trim())
    .join(" ");
  const country = stammdaten.country?.trim() ?? "";
  const phone = stammdaten.phone?.trim() ?? "";
  const website = stammdaten.website?.trim() ?? "";
  const vatNumber = stammdaten.vatNumber?.trim() ?? "";
  const receiptFooter = stammdaten.receiptFooter?.trim() ?? "";

  const lines: string[] = [...buildAddressLines(stammdaten)];
  if (phone) lines.push(`Tel. ${phone}`);
  if (website) lines.push(website);
  if (vatNumber) lines.push(`USt-IdNr. ${vatNumber}`);

  return {
    name: stammdaten.name?.trim() || "Restaurant",
    street,
    cityLine,
    country,
    phone,
    website,
    vatNumber,
    receiptFooter,
    lines,
  };
}

async function loadLogoForPdf(
  avatarStoragePath: string | null,
  showLogo: boolean,
): Promise<AccountingPdfRenderContext["logo"]> {
  if (!showLogo || !avatarStoragePath?.trim()) return null;

  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.storage
    .from(RESTAURANT_PROFILE_IMAGES_BUCKET)
    .download(avatarStoragePath.trim());

  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  const lower = avatarStoragePath.toLowerCase();
  if (lower.endsWith(".webp")) return null;
  let format: "JPEG" | "PNG" = "PNG";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) format = "JPEG";

  let widthPx = 1;
  let heightPx = 1;
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    widthPx = Math.max(1, meta.width ?? 1);
    heightPx = Math.max(1, meta.height ?? 1);
  } catch {
    /* Fallback 1:1 */
  }

  return {
    base64: buffer.toString("base64"),
    format,
    widthPx,
    heightPx,
  };
}

export async function loadAccountingPdfRenderContext(
  sb: SupabaseClient,
  restaurantId: string,
  design: AccountingDocumentDesign,
): Promise<AccountingPdfRenderContext> {
  const stammdaten =
    (await fetchRestaurantStammdatenFromDb(sb, restaurantId)) ?? {
      name: "Restaurant",
      street: "",
      postalCode: "",
      city: "",
      country: "",
      phone: "",
      website: "",
      vatNumber: "",
      avatarStoragePath: null,
    };

  const company = buildCompanyBlock(stammdaten);
  const logo = await loadLogoForPdf(
    stammdaten.avatarStoragePath ?? null,
    design.layoutBlocks.some((block) => block.type === "logo"),
  );

  return { design, company, logo };
}

export function mergeAccountingSettingsRow(
  data: Record<string, unknown> | null,
  restaurantId: string,
) {
  if (!data) {
    const connector_settings = parseConnectorSettings(null);
    const legacy = legacyLexofficeFieldsFromConnectorSettings(connector_settings);
    return {
      restaurant_id: restaurantId,
      document_format: "pdf" as const,
      connector_settings,
      ...legacy,
      deduct_inventory_on_invoice: false,
      reverse_inventory_on_invoice_correction: false,
      import_pos_z_to_cash_book: false,
      push_pos_z_to_lexoffice: false,
      document_design: parseAccountingDocumentDesign(null),
      invoice_number_prefix: "RE",
      quotation_number_prefix: "AN",
      invoice_correction_number_prefix: "KO",
      invoice_number_include_year: true,
      quotation_number_include_year: true,
      invoice_number_min_digits: 4,
      quotation_number_min_digits: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const connector_settings = parseConnectorSettings(data.connector_settings, {
    auto_sync_lexoffice: data.auto_sync_lexoffice as boolean | undefined,
    last_lexoffice_invoices_sync_at:
      (data.last_lexoffice_invoices_sync_at as string | null | undefined) ?? null,
    last_lexoffice_quotations_sync_at:
      (data.last_lexoffice_quotations_sync_at as string | null | undefined) ??
      null,
    last_lexoffice_vouchers_sync_at:
      (data.last_lexoffice_vouchers_sync_at as string | null | undefined) ?? null,
  });
  const legacy = legacyLexofficeFieldsFromConnectorSettings(connector_settings);
  return {
    ...data,
    connector_settings,
    ...legacy,
    deduct_inventory_on_invoice:
      (data.deduct_inventory_on_invoice as boolean | undefined) ?? false,
    reverse_inventory_on_invoice_correction:
      (data.reverse_inventory_on_invoice_correction as boolean | undefined) ??
      false,
    import_pos_z_to_cash_book:
      (data.import_pos_z_to_cash_book as boolean | undefined) ?? false,
    push_pos_z_to_lexoffice:
      (data.push_pos_z_to_lexoffice as boolean | undefined) ?? false,
    invoice_number_prefix:
      (data.invoice_number_prefix as string | undefined)?.trim() || "RE",
    quotation_number_prefix:
      (data.quotation_number_prefix as string | undefined)?.trim() || "AN",
    invoice_correction_number_prefix:
      (data.invoice_correction_number_prefix as string | undefined)?.trim() ||
      "KO",
    invoice_number_include_year:
      (data.invoice_number_include_year as boolean | undefined) ?? true,
    quotation_number_include_year:
      (data.quotation_number_include_year as boolean | undefined) ?? true,
    invoice_number_min_digits:
      (data.invoice_number_min_digits as number | undefined) ?? 4,
    quotation_number_min_digits:
      (data.quotation_number_min_digits as number | undefined) ?? 4,
    document_design: parseAccountingDocumentDesign(data.document_design),
  };
}
