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
    return {
      restaurant_id: restaurantId,
      document_format: "pdf" as const,
      auto_sync_lexoffice: true,
      document_design: parseAccountingDocumentDesign(null),
      last_lexoffice_invoices_sync_at: null,
      last_lexoffice_quotations_sync_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return {
    ...data,
    document_design: parseAccountingDocumentDesign(data.document_design),
  };
}
