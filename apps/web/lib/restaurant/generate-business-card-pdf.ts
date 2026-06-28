import {
  activeDecorationsForSide,
  activeElementsForSide,
  BUSINESS_CARD_LOGO_IMAGE_INSET_PCT,
  BUSINESS_CARD_LOGO_INNER_SCALE,
  businessCardFormatById,
  businessCardFontSizePt,
  businessCardOptionsFromDesign,
  type BusinessCardDecoration,
  type BusinessCardDesign,
  type BusinessCardElement,
  type BusinessCardRect,
} from "@/lib/restaurant/business-card-design";
import type { BusinessCardContent } from "@/lib/restaurant/business-card-layout";
import { isBusinessCardImageDecoration } from "@/lib/restaurant/business-card-shape-decoration";
import {
  containImageToDataUrl,
  cropImageToDataUrl,
  loadImageForPdf,
  type LoadedCardImage,
} from "@/lib/restaurant/business-card-image-utils";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

export type BusinessCardPdfInput = {
  content: BusinessCardContent;
  design: BusinessCardDesign;
  coverUrl?: string | null;
  logoUrl?: string | null;
};

function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? DEFAULT_ACCENT_HEX;
  return [
    parseInt(n.slice(1, 3), 16),
    parseInt(n.slice(3, 5), 16),
    parseInt(n.slice(5, 7), 16),
  ];
}

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  return name.trim().slice(0, 2).toLocaleUpperCase("de-DE") || "?";
}

function rectToMm(
  rect: BusinessCardRect,
  cardW: number,
  cardH: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: (rect.x / 100) * cardW,
    y: (rect.y / 100) * cardH,
    w: (rect.w / 100) * cardW,
    h: (rect.h / 100) * cardH,
  };
}

const PDF_PX_PER_MM = 24;

function drawLogoInRect(
  doc: import("jspdf").jsPDF,
  logo: LoadedCardImage | null,
  accent: [number, number, number],
  initials: string,
  initialsFontPt: number,
  box: { x: number; y: number; w: number; h: number },
) {
  const size = Math.min(box.w, box.h) * BUSINESS_CARD_LOGO_INNER_SCALE;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const radius = size / 2 - 0.5;
  const ringRadius = radius + 0.45;
  const innerSide = size * (1 - (2 * BUSINESS_CARD_LOGO_IMAGE_INSET_PCT) / 100);

  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, ringRadius, "F");
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, ringRadius, "S");

  if (logo) {
    doc.addImage(
      logo.dataUrl,
      logo.format,
      cx - innerSide / 2,
      cy - innerSide / 2,
      innerSide,
      innerSide,
      undefined,
      "SLOW",
    );
  } else {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.circle(cx, cy, radius, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(initialsFontPt);
    doc.text(initials.slice(0, 2).toUpperCase(), cx, cy + initialsFontPt * 0.04, {
      align: "center",
    });
  }
}

function drawElement(
  doc: import("jspdf").jsPDF,
  element: BusinessCardElement,
  content: BusinessCardContent,
  design: BusinessCardDesign,
  accent: [number, number, number],
  textRgb: [number, number, number],
  mutedRgb: [number, number, number],
  cardW: number,
  cardH: number,
  cover: LoadedCardImage | null,
  logo: LoadedCardImage | null,
) {
  const box = rectToMm(element.rect, cardW, cardH);
  const padX = Math.min(box.w * 0.04, 1.2);
  const fontPt = (factor: number) =>
    businessCardFontSizePt(element.rect, factor, design.formatId);

  switch (element.type) {
    case "name": {
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontPt(0.42));
      const lines = doc.splitTextToSize(content.name, box.w - padX * 2) as string[];
      let y = box.y + fontPt(0.42) * 0.95;
      for (const line of lines.slice(0, 2)) {
        doc.text(line, box.x + padX, y);
        y += fontPt(0.42) * 0.38;
      }
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.rect(box.x + padX, y, box.w * 0.28, 0.5, "F");
      break;
    }
    case "address": {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontPt(0.28));
      doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
      let y = box.y + fontPt(0.28);
      for (const line of content.addressLines) {
        doc.text(line, box.x + padX, y);
        y += fontPt(0.28) * 0.95;
      }
      break;
    }
    case "phone":
      if (content.phone) {
        doc.setFont("helvetica", "normal");
        const fs = fontPt(0.32);
        doc.setFontSize(fs);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        const dims = doc.getTextDimensions(content.phone);
        doc.text(
          content.phone,
          box.x + padX,
          box.y + (box.h + dims.h) / 2,
        );
      }
      break;
    case "website":
      if (content.websiteLabel) {
        doc.setFont("helvetica", "normal");
        const fs = fontPt(0.32);
        doc.setFontSize(fs);
        doc.setTextColor(accent[0], accent[1], accent[2]);
        const dims = doc.getTextDimensions(content.websiteLabel);
        doc.text(
          content.websiteLabel,
          box.x + padX,
          box.y + (box.h + dims.h) / 2,
        );
      }
      break;
    case "cover":
      if (cover) {
        doc.addImage(
          cover.dataUrl,
          cover.format,
          box.x,
          box.y,
          box.w,
          box.h,
          undefined,
          "SLOW",
        );
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(box.x, box.y + box.h - 0.4, box.w, 0.4, "F");
      }
      break;
    case "logo":
      drawLogoInRect(
        doc,
        logo,
        accent,
        restaurantInitials(content.name),
        fontPt(0.35),
        box,
      );
      break;
    case "openingHours": {
      if (!content.hourRows.length) break;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontPt(0.22));
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text("ÖFFNUNGSZEITEN", box.x + padX, box.y + fontPt(0.22));
      let y = box.y + fontPt(0.22) + 1.2;
      const lineH = fontPt(0.2) * 0.95;
      doc.setFontSize(fontPt(0.2));
      doc.setFont("helvetica", "bold");
      let maxLabelWidth = 0;
      for (const row of content.hourRows) {
        maxLabelWidth = Math.max(maxLabelWidth, doc.getTextWidth(row.label));
      }
      const valueX = box.x + padX + maxLabelWidth + 1.2;
      for (const row of content.hourRows) {
        if (y > box.y + box.h - 1) break;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        doc.text(row.label, box.x + padX, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        doc.text(row.value, valueX, y);
        y += lineH;
      }
      break;
    }
    case "gwadaFooter": {
      doc.setDrawColor(220, 220, 224);
      doc.setLineWidth(0.1);
      doc.line(box.x, box.y + 0.5, box.x + box.w, box.y + 0.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontPt(0.45));
      doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
      doc.text("ERSTELLT MIT GWADA", box.x + box.w / 2, box.y + fontPt(0.45) + 1.2, {
        align: "center",
      });
      break;
    }
    default:
      break;
  }
}


function drawDecoration(
  doc: import("jspdf").jsPDF,
  decoration: BusinessCardDecoration,
  cardW: number,
  cardH: number,
) {
  if (!isBusinessCardImageDecoration(decoration) || !decoration.dataUrl) return;
  const box = rectToMm(decoration.rect, cardW, cardH);
  doc.addImage(
    decoration.dataUrl,
    decoration.format,
    box.x,
    box.y,
    box.w,
    box.h,
    undefined,
    "SLOW",
  );
}

function drawLayoutSide(
  doc: import("jspdf").jsPDF,
  side: "front" | "back",
  input: {
    content: BusinessCardContent;
    design: BusinessCardDesign;
    accent: [number, number, number];
    textRgb: [number, number, number];
    mutedRgb: [number, number, number];
    bgRgb: [number, number, number];
    cardW: number;
    cardH: number;
    cover: LoadedCardImage | null;
    logo: LoadedCardImage | null;
  },
) {
  const { cardW, cardH, bgRgb } = input;
  doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
  doc.rect(0, 0, cardW, cardH, "F");

  const options = businessCardOptionsFromDesign(input.design);
  const elements = activeElementsForSide(input.design, side);

  for (const element of elements) {
    if (element.type === "cover" && (!options.showCover || !input.cover)) continue;
    if (element.type === "logo" && !options.showLogo) continue;
    if (element.type === "address" && !contentHasAddress(input.content)) continue;
    if (element.type === "phone" && !input.content.phone) continue;
    if (element.type === "website" && !input.content.websiteLabel) continue;
    if (element.type === "openingHours" && input.content.hourRows.length === 0) continue;

    drawElement(
      doc,
      element,
      input.content,
      input.design,
      input.accent,
      input.textRgb,
      input.mutedRgb,
      cardW,
      cardH,
      input.cover,
      input.logo,
    );
  }

  for (const decoration of activeDecorationsForSide(input.design, side)) {
    drawDecoration(doc, decoration, cardW, cardH);
  }
}

function contentHasAddress(content: BusinessCardContent): boolean {
  return content.addressLines.length > 0;
}

export async function generateBusinessCardPdf(
  input: BusinessCardPdfInput,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const format = businessCardFormatById(input.design.formatId);
  const cardW = format.widthMm;
  const cardH = format.heightMm;

  const accent = hexToRgb(input.design.colors.accent);
  const textRgb = hexToRgb(input.design.colors.text);
  const mutedRgb = hexToRgb(input.design.colors.muted);
  const bgRgb = hexToRgb(input.design.colors.background);

  const options = businessCardOptionsFromDesign(input.design);
  const hasCoverImage = Boolean(input.coverUrl?.trim());
  const effectiveShowCover = options.showCover && hasCoverImage;

  const coverSource = effectiveShowCover
    ? await loadImageForPdf(input.coverUrl)
    : null;
  const logoSource = options.showLogo
    ? await loadImageForPdf(input.logoUrl)
    : null;

  const pxPerMm = PDF_PX_PER_MM;
  const coverElement = input.design.elements.find((e) => e.type === "cover");
  const coverRect = coverElement?.enabled
    ? rectToMm(coverElement.rect, cardW, cardH)
    : { w: cardW, h: 12 };

  const cover =
    coverSource &&
    (await cropImageToDataUrl(
      coverSource,
      coverRect.w * pxPerMm,
      coverRect.h * pxPerMm,
    ));

  const logoElement = input.design.elements.find((e) => e.type === "logo");
  const logoRect = logoElement?.enabled
    ? rectToMm(logoElement.rect, cardW, cardH)
    : { w: 20, h: 20 };
  const logoSizeMm = Math.min(logoRect.w, logoRect.h) * BUSINESS_CARD_LOGO_INNER_SCALE;
  const logoImageMm =
    logoSizeMm * (1 - (2 * BUSINESS_CARD_LOGO_IMAGE_INSET_PCT) / 100);
  const logoPx = Math.max(96, Math.round(logoImageMm * pxPerMm));

  const logo =
    logoSource &&
    (await containImageToDataUrl(logoSource, logoPx, logoPx, {
      background: "#ffffff",
    }));

  const doc = new jsPDF({
    orientation: cardW >= cardH ? "landscape" : "portrait",
    unit: "mm",
    format: [cardW, cardH],
  });

  const drawCtx = {
    content: input.content,
    design: input.design,
    accent,
    textRgb,
    mutedRgb,
    bgRgb,
    cardW,
    cardH,
    cover: effectiveShowCover ? cover : null,
    logo,
  };

  drawLayoutSide(doc, "front", drawCtx);
  doc.addPage([cardW, cardH], cardW >= cardH ? "landscape" : "portrait");
  drawLayoutSide(doc, "back", drawCtx);

  return doc.output("blob");
}

/** @deprecated — nur für Abwärtskompatibilität in Tests */
export type LegacyBusinessCardPdfInput = BusinessCardPdfInput;
