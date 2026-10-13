import { printJsPdfDocument } from "@/lib/export/print-jspdf-document";
import { applyJsPdfPageNumbers } from "@/lib/pdf/jspdf-page-numbers";
import { formatRestaurantDateTime } from "@/lib/restaurant/restaurant-timezone";
import type { DisplayGuide } from "@/lib/types/guides";
import type { jsPDF } from "jspdf";

export type DisplayGuidePrintOptions = {
  restaurantName?: string;
  timeZone?: string;
};

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildDisplayGuidePdfDocument(
  guide: DisplayGuide,
  options?: DisplayGuidePrintOptions,
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = guide.title.trim() || "Anleitung";
  const exportedAt = formatRestaurantDateTime(new Date(), options?.timeZone);

  doc.setFontSize(14);
  doc.text("Anleitung", 14, 16);
  doc.setFontSize(10);
  let y = 22;
  if (options?.restaurantName?.trim()) {
    doc.text(options.restaurantName.trim(), 14, y);
    y += 5;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y + 4);
  doc.setFont("helvetica", "normal");
  y += 10;

  const description = guide.short_description.trim();
  if (description) {
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(description, 186);
    doc.text(wrapped, 14, y + 2);
    y += wrapped.length * 4 + 2;
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Exportiert ${exportedAt}`, 14, y + 2);
  doc.setTextColor(0);
  y += 10;

  const steps = [...guide.steps].sort((a, b) => a.position - b.position);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Schritt ${i + 1}`, 14, y);
    doc.setFont("helvetica", "normal");
    y += 6;

    const body = step.body.trim() || "—";
    doc.setFontSize(10);
    const bodyLines = doc.splitTextToSize(body, 186);
    doc.text(bodyLines, 14, y);
    y += bodyLines.length * 5 + 2;

    if (step.image_url) {
      const dataUrl = await loadImageAsDataUrl(step.image_url);
      if (dataUrl) {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }
        try {
          const format = dataUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, format, 14, y, 80, 60, undefined, "FAST");
          y += 66;
        } catch {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text("(Bild konnte nicht eingebettet werden)", 14, y);
          doc.setTextColor(0);
          y += 6;
        }
      }
    }

    if (step.has_video) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text("Video: siehe Display/App", 14, y);
      doc.setTextColor(0);
      y += 8;
    }

    y += 4;
  }

  applyJsPdfPageNumbers(doc);
  return doc;
}

export async function printDisplayGuide(
  guide: DisplayGuide,
  options?: DisplayGuidePrintOptions,
): Promise<void> {
  const doc = await buildDisplayGuidePdfDocument(guide, options);
  const safeName = (guide.title.trim() || "Anleitung")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .slice(0, 80);
  await printJsPdfDocument(doc, {
    shareFilename: `${safeName}.pdf`,
  });
}
