import { RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS_LABEL } from "@/lib/constants/restaurant-documents";
import {
  restaurantDocumentDownloadUrl,
  uploadRestaurantDocumentClient,
} from "@/lib/documents/documents-api";
import { validateRestaurantDocumentFile } from "@/lib/documents/validate-restaurant-document-file";
import {
  defaultDecorationRect,
  type BusinessCardDecoration,
  type BusinessCardDesign,
  type BusinessCardSide,
} from "@/lib/restaurant/business-card-design";
import {
  isBusinessCardDecorationFile,
  readBusinessCardDecorationAspect,
} from "@/lib/restaurant/business-card-decoration-file";
import {
  isBusinessCardImageDecoration,
} from "@/lib/restaurant/business-card-shape-decoration";
import { trackDashboardFileUpload } from "@/lib/uploads/dashboard-file-upload";
import { urlToDataUrl } from "@/lib/restaurant/capture-business-card-pdf";
import type { BusinessCardImageDecoration } from "@/lib/restaurant/business-card-shape-decoration";

export function businessCardDecorationDocumentTitle(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim() || fileName.trim() || "Dekorbild";
  return `Visitenkarte: ${base}`;
}

export function businessCardDecorationImageUrl(
  restaurantId: string,
  decoration: BusinessCardDecoration,
): string | null {
  if (!isBusinessCardImageDecoration(decoration)) return null;
  if (decoration.dataUrl) {
    return decoration.dataUrl;
  }
  if (decoration.documentId) {
    return restaurantDocumentDownloadUrl({
      restaurantId,
      documentId: decoration.documentId,
    });
  }
  return null;
}

function decorationUploadErrorMessage(code: string | undefined): string {
  switch (code) {
    case "storage_quota_exceeded":
      return "Speicherlimit erreicht (max. 3 GB pro Restaurant).";
    case "invalid_file":
      return `Nur JPG/PNG (${RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS_LABEL} für Dokumente).`;
    default:
      return code ?? "Upload fehlgeschlagen.";
  }
}

export async function uploadBusinessCardDecorationDocument(params: {
  restaurantId: string;
  file: File;
}): Promise<{ documentId?: string; error?: string }> {
  return trackDashboardFileUpload(
    () =>
      uploadRestaurantDocumentClient({
        restaurantId: params.restaurantId,
        file: params.file,
        title: businessCardDecorationDocumentTitle(params.file.name),
      }),
    {
      message: "Dekorbild wird hochgeladen …",
      successMessage: "Dekorbild hochgeladen.",
      errorMessage: decorationUploadErrorMessage,
    },
  );
}

export async function createBusinessCardDecorationFromFile(params: {
  restaurantId: string;
  file: File;
  design: BusinessCardDesign;
  side: BusinessCardSide;
  dropPosition?: { xPct: number; yPct: number };
}): Promise<
  | { ok: true; decoration: Omit<BusinessCardImageDecoration, "id"> }
  | { ok: false; error: string; alreadyNotified?: boolean }
> {
  if (!isBusinessCardDecorationFile(params.file)) {
    return { ok: false, error: "Nur JPG- oder PNG-Dateien sind möglich." };
  }

  const fileValidation = validateRestaurantDocumentFile(params.file);
  if (fileValidation) {
    return { ok: false, error: fileValidation };
  }

  const aspect = await readBusinessCardDecorationAspect(params.file);
  if (!aspect) {
    return { ok: false, error: "Bild konnte nicht gelesen werden." };
  }

  const { documentId, error } = await uploadBusinessCardDecorationDocument({
    restaurantId: params.restaurantId,
    file: params.file,
  });

  if (error || !documentId) {
    return {
      ok: false,
      error: decorationUploadErrorMessage(error),
      alreadyNotified: true,
    };
  }

  const format = params.file.type === "image/png" ? "PNG" : "JPEG";

  return {
    ok: true,
    decoration: {
      side: params.side,
      rect: defaultDecorationRect(aspect, params.design.formatId, params.dropPosition),
      fileName: params.file.name.trim() || (format === "PNG" ? "bild.png" : "bild.jpg"),
      format,
      documentId,
    },
  };
}

/** Dekorbilder für PDF-Export als eingebettete Data-URLs auflösen. */
export async function prepareBusinessCardDesignForExport(
  design: BusinessCardDesign,
  restaurantId: string,
): Promise<BusinessCardDesign> {
  if (!design.decorations.length) return design;

  const decorations = await Promise.all(
    design.decorations.map(async (decoration) => {
      if (!isBusinessCardImageDecoration(decoration)) return decoration;
      if (decoration.dataUrl) return decoration;

      const url = businessCardDecorationImageUrl(restaurantId, decoration);
      if (!url) return decoration;

      const dataUrl = await urlToDataUrl(url);
      if (!dataUrl) return decoration;

      return { ...decoration, dataUrl };
    }),
  );

  return { ...design, decorations };
}
