import {
  BUSINESS_CARD_HEIGHT_MM,
  BUSINESS_CARD_WIDTH_MM,
  type BusinessCardContent,
  type BusinessCardOptions,
} from "@/lib/restaurant/business-card-layout";
import {
  cropImageToDataUrl,
  loadImageForPdf,
  type LoadedCardImage,
} from "@/lib/restaurant/business-card-image-utils";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

export type BusinessCardPdfInput = {
  content: BusinessCardContent;
  options: BusinessCardOptions;
  accentHex: string;
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

function drawFrontSide(
  doc: import("jspdf").jsPDF,
  content: BusinessCardContent,
  accent: [number, number, number],
) {
  const w = BUSINESS_CARD_WIDTH_MM;
  const h = BUSINESS_CARD_HEIGHT_MM;
  const margin = 7;
  const contentW = w - margin * 2;

  doc.setFillColor(252, 252, 253);
  doc.rect(0, 0, w, h, "F");

  let y = margin + 2;

  doc.setTextColor(18, 18, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const nameLines = doc.splitTextToSize(content.name, contentW) as string[];
  for (const line of nameLines.slice(0, 2)) {
    doc.text(line, margin, y);
    y += 5.2;
  }

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(margin, y + 0.5, 18, 0.6, "F");
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(48, 48, 54);

  for (const line of content.addressLines) {
    doc.text(line, margin, y);
    y += 3.6;
  }

  if (content.phone) {
    doc.text(content.phone, margin, y);
    y += 3.6;
  }

  if (content.websiteLabel) {
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(content.websiteLabel, margin, y);
    doc.setTextColor(48, 48, 54);
  }
}

function drawCoverStrip(
  doc: import("jspdf").jsPDF,
  cover: LoadedCardImage,
  stripH: number,
) {
  const w = BUSINESS_CARD_WIDTH_MM;
  doc.addImage(cover.dataUrl, cover.format, 0, 0, w, stripH, undefined, "FAST");
}

function drawLogo(
  doc: import("jspdf").jsPDF,
  logo: LoadedCardImage | null,
  accent: [number, number, number],
  initials: string,
  cx: number,
  cy: number,
  radius: number,
) {
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, radius + 0.8, "F");
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, radius + 0.8, "S");

  if (logo) {
    doc.addImage(
      logo.dataUrl,
      logo.format,
      cx - radius,
      cy - radius,
      radius * 2,
      radius * 2,
      undefined,
      "FAST",
    );
  } else {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.circle(cx, cy, radius, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(initials.slice(0, 2).toUpperCase(), cx, cy + 1, {
      align: "center",
    });
  }
}

function drawHours(
  doc: import("jspdf").jsPDF,
  rows: BusinessCardContent["hourRows"],
  startY: number,
  maxY: number,
  accent: [number, number, number],
): number {
  if (!rows.length) return startY;

  const margin = 7;
  const w = BUSINESS_CARD_WIDTH_MM;
  const contentW = w - margin * 2;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text("Öffnungszeiten", margin, y);
  y += 3.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(55, 55, 60);

  const lineH = 3.1;
  for (const row of rows) {
    if (y + lineH > maxY) break;
    doc.setFont("helvetica", "bold");
    doc.text(row.label, margin, y);
    doc.setFont("helvetica", "normal");
    const valueLines = doc.splitTextToSize(row.value, contentW - 14) as string[];
    doc.text(valueLines[0] ?? row.value, margin + 13, y);
    y += lineH;
  }

  return y;
}

function drawBackSide(
  doc: import("jspdf").jsPDF,
  content: BusinessCardContent,
  options: BusinessCardOptions,
  accent: [number, number, number],
  cover: LoadedCardImage | null,
  logo: LoadedCardImage | null,
) {
  const w = BUSINESS_CARD_WIDTH_MM;
  const h = BUSINESS_CARD_HEIGHT_MM;
  const margin = 7;
  const footerReserve = options.showGwadaFooter ? 6 : 2;
  const maxContentY = h - footerReserve;

  doc.setFillColor(252, 252, 253);
  doc.rect(0, 0, w, h, "F");

  let y = margin;

  const showCoverStrip = options.showCover && cover !== null;
  if (showCoverStrip && cover) {
    const stripH = 12;
    drawCoverStrip(doc, cover, stripH);
    y = stripH + 4;
  }

  if (options.showLogo) {
    const logoRadius = showCoverStrip ? 8 : 10;
    const logoCy = showCoverStrip ? y + logoRadius : h * 0.32;
    drawLogo(
      doc,
      logo,
      accent,
      restaurantInitials(content.name),
      w / 2,
      logoCy,
      logoRadius,
    );
    y = logoCy + logoRadius + 4;
  } else if (!showCoverStrip) {
    y = margin + 2;
  }

  if (content.hourRows.length > 0) {
    const hoursStartY = options.showLogo
      ? y
      : showCoverStrip
        ? y
        : margin + 2;
    drawHours(doc, content.hourRows, hoursStartY, maxContentY, accent);
  }

  if (options.showGwadaFooter) {
    const footerY = h - 3.5;
    doc.setDrawColor(230, 230, 234);
    doc.setLineWidth(0.12);
    doc.line(margin, footerY - 2.5, w - margin, footerY - 2.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(140, 140, 148);
    doc.text("Erstellt mit Gwada", w / 2, footerY, { align: "center" });
  }
}

export async function generateBusinessCardPdf(
  input: BusinessCardPdfInput,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const accent = hexToRgb(input.accentHex);
  const { content, options } = input;

  const hasCoverImage = Boolean(input.coverUrl?.trim());
  const effectiveShowCover = options.showCover && hasCoverImage;

  const coverSource = effectiveShowCover
    ? await loadImageForPdf(input.coverUrl)
    : null;
  const logoSource = options.showLogo
    ? await loadImageForPdf(input.logoUrl)
    : null;

  const pxPerMm = 12;
  const cover =
    coverSource &&
    (await cropImageToDataUrl(
      coverSource,
      BUSINESS_CARD_WIDTH_MM * pxPerMm,
      12 * pxPerMm,
    ));
  const logo =
    logoSource &&
    (await cropImageToDataUrl(logoSource, 20 * pxPerMm, 20 * pxPerMm));

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [BUSINESS_CARD_WIDTH_MM, BUSINESS_CARD_HEIGHT_MM],
  });

  drawFrontSide(doc, content, accent);

  doc.addPage([BUSINESS_CARD_WIDTH_MM, BUSINESS_CARD_HEIGHT_MM], "landscape");
  drawBackSide(doc, content, { ...options, showCover: effectiveShowCover }, accent, cover, logo);

  return doc.output("blob");
}
