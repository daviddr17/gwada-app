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

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function drawCoverBand(
  doc: import("jspdf").jsPDF,
  accent: [number, number, number],
  cover: LoadedCardImage | null,
  showCover: boolean,
) {
  const w = BUSINESS_CARD_WIDTH_MM;
  const h = 50;

  if (showCover && cover) {
    doc.addImage(cover.dataUrl, cover.format, 0, 0, w, h, undefined, "FAST");
    const fadeH = 20;
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const c = mixRgb([255, 255, 255], [12, 14, 22], 0.5 * t);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(0, h - fadeH + (fadeH / steps) * i, w, fadeH / steps + 0.15, "F");
    }
  } else {
    const top = mixRgb(accent, [255, 255, 255], 0.12);
    const bottom = mixRgb(accent, [20, 24, 32], 0.55);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const c = mixRgb(top, bottom, t);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(0, (h / steps) * i, w, h / steps + 0.2, "F");
    }
  }

  const [r, g, b] = accent;
  doc.setFillColor(r, g, b);
  doc.rect(0, h - 1.2, w, 1.2, "F");
}

function drawLogo(
  doc: import("jspdf").jsPDF,
  logo: LoadedCardImage | null,
  accent: [number, number, number],
  initials: string,
) {
  const cx = 14;
  const cy = 50;
  const radius = 11;

  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, radius + 1.1, "F");
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.35);
  doc.circle(cx, cy, radius + 1.1, "S");

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
    doc.setFontSize(11);
    doc.text(initials.slice(0, 2).toUpperCase(), cx, cy + 1.2, {
      align: "center",
    });
  }
}

function drawHours(
  doc: import("jspdf").jsPDF,
  rows: BusinessCardContent["hourRows"],
  startY: number,
  accent: [number, number, number],
): number {
  if (!rows.length) return startY;

  const colW = (BUSINESS_CARD_WIDTH_MM - 16) / 2;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text("Öffnungszeiten", 8, y);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(55, 55, 60);

  const left = rows.slice(0, Math.ceil(rows.length / 2));
  const right = rows.slice(Math.ceil(rows.length / 2));
  const rowCount = Math.max(left.length, right.length);

  for (let i = 0; i < rowCount; i++) {
    const ly = y + i * 3.6;
    const l = left[i];
    const r = right[i];
    if (l) {
      doc.setFont("helvetica", "bold");
      doc.text(l.label.slice(0, 2), 8, ly);
      doc.setFont("helvetica", "normal");
      doc.text(l.value, 8 + 7, ly);
    }
    if (r) {
      doc.setFont("helvetica", "bold");
      doc.text(r.label.slice(0, 2), 8 + colW, ly);
      doc.setFont("helvetica", "normal");
      doc.text(r.value, 8 + colW + 7, ly);
    }
  }

  return y + rowCount * 3.6 + 2;
}

export async function generateBusinessCardPdf(
  input: BusinessCardPdfInput,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const accent = hexToRgb(input.accentHex);
  const { content, options } = input;

  const coverSource = options.showCover
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
      50 * pxPerMm,
    ));
  const logo =
    logoSource &&
    (await cropImageToDataUrl(logoSource, 22 * pxPerMm, 22 * pxPerMm));

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [BUSINESS_CARD_WIDTH_MM, BUSINESS_CARD_HEIGHT_MM],
  });

  doc.setFillColor(252, 252, 253);
  doc.rect(0, 0, BUSINESS_CARD_WIDTH_MM, BUSINESS_CARD_HEIGHT_MM, "F");

  drawCoverBand(doc, accent, cover, options.showCover);

  if (options.showLogo) {
    const initials = content.name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2);
    drawLogo(doc, logo, accent, initials || "?");
  }

  let y = options.showLogo ? 64 : 54;

  doc.setTextColor(18, 18, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const nameLines = doc.splitTextToSize(
    content.name,
    BUSINESS_CARD_WIDTH_MM - 16,
  ) as string[];
  for (const line of nameLines.slice(0, 2)) {
    doc.text(line, 8, y);
    y += 6.2;
  }

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(8, y + 0.8, 22, 0.7, "F");
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(48, 48, 54);

  for (const line of content.addressLines) {
    doc.text(line, 8, y);
    y += 4.2;
  }

  if (content.phone) {
    doc.text(content.phone, 8, y);
    y += 4.2;
  }

  if (content.websiteLabel) {
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(content.websiteLabel, 8, y);
    doc.setTextColor(48, 48, 54);
    y += 4.2;
  }

  if (content.hourRows.length > 0) {
    y += 2;
    y = drawHours(doc, content.hourRows, y, accent);
  }

  if (options.showGwadaFooter) {
    const footerY = BUSINESS_CARD_HEIGHT_MM - 5;
    doc.setDrawColor(230, 230, 234);
    doc.setLineWidth(0.15);
    doc.line(8, footerY - 3, BUSINESS_CARD_WIDTH_MM - 8, footerY - 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(140, 140, 148);
    doc.text("Erstellt mit Gwada", BUSINESS_CARD_WIDTH_MM / 2, footerY, {
      align: "center",
    });
  }

  return doc.output("blob");
}
