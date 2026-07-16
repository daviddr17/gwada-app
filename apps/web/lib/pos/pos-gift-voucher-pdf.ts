import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RESTAURANT_PROFILE_IMAGES_BUCKET } from "@/lib/restaurant/restaurant-profile-image";
import type { PosGiftVoucherRow } from "@/lib/types/pos-gift-vouchers";
import { buildPosGiftVoucherQrPayload } from "@/lib/types/pos-gift-vouchers";

type LogoForPdf = {
  base64: string;
  format: "JPEG" | "PNG";
  widthPx: number;
  heightPx: number;
} | null;

function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDateDe(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function loadRestaurantLogo(
  avatarStoragePath: string | null,
): Promise<LogoForPdf> {
  if (!avatarStoragePath?.trim()) return null;
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
    /* ignore */
  }

  return {
    base64: buffer.toString("base64"),
    format,
    widthPx,
    heightPx,
  };
}

async function loadRestaurantHeader(restaurantId: string): Promise<{
  name: string;
  addressLine: string;
  logo: LogoForPdf;
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { name: "Restaurant", addressLine: "", logo: null };
  }

  const { data } = await admin
    .from("restaurants")
    .select(
      "name, address_line1, postal_code, city, avatar_storage_path",
    )
    .eq("id", restaurantId)
    .maybeSingle();

  const name = String(data?.name ?? "Restaurant");
  const parts = [
    data?.address_line1,
    [data?.postal_code, data?.city].filter(Boolean).join(" "),
  ].filter((p) => String(p ?? "").trim());

  return {
    name,
    addressLine: parts.join(" · "),
    logo: await loadRestaurantLogo(
      (data?.avatar_storage_path as string | null) ?? null,
    ),
  };
}

/** DIN-A4 Gutschein-PDF mit Logo und QR-Code. */
export async function generatePosGiftVoucherA4Pdf(
  voucher: PosGiftVoucherRow,
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const QRCode = (await import("qrcode")).default;
  const header = await loadRestaurantHeader(voucher.restaurant_id);
  const qrPayload = buildPosGiftVoucherQrPayload(voucher.public_token);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;

  // Soft atmosphere
  doc.setFillColor(248, 246, 242);
  doc.rect(0, 0, pageW, 297, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, margin, pageW - margin * 2, 261, 4, 4, "F");
  doc.setDrawColor(220, 214, 204);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, margin, pageW - margin * 2, 261, 4, 4, "S");

  let y = margin + 16;

  if (header.logo) {
    const maxW = 36;
    const maxH = 22;
    const ratio = header.logo.widthPx / header.logo.heightPx;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    doc.addImage(
      `data:image/${header.logo.format.toLowerCase()};base64,${header.logo.base64}`,
      header.logo.format,
      (pageW - w) / 2,
      y,
      w,
      h,
    );
    y += h + 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text(header.name, pageW / 2, y, { align: "center" });
  y += 8;

  if (header.addressLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(header.addressLine, pageW / 2, y, { align: "center" });
    y += 10;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(110, 100, 90);
  doc.text("WERTGUTSCHEIN", pageW / 2, y, { align: "center" });
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(28, 28, 28);
  doc.text(formatEuroFromCents(voucher.balance_cents), pageW / 2, y, {
    align: "center",
  });
  y += 8;

  if (voucher.balance_cents !== voucher.initial_amount_cents) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Restguthaben (ursprünglich ${formatEuroFromCents(voucher.initial_amount_cents)})`,
      pageW / 2,
      y,
      { align: "center" },
    );
    y += 8;
  }

  y += 6;
  const qrSize = 52;
  doc.addImage(qrDataUrl, "PNG", (pageW - qrSize) / 2, y, qrSize, qrSize);
  y += qrSize + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(voucher.code, pageW / 2, y, { align: "center" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const lines = [
    `Ausgestellt am ${formatDateDe(voucher.issued_at)}`,
    `Gültig bis ${formatDateDe(voucher.expires_at)}`,
    "Mehrfach einlösbar bis das Guthaben aufgebraucht ist.",
    "Beim Einlösen bitte diesen Gutschein vorzeigen oder scannen.",
  ];
  for (const line of lines) {
    doc.text(line, pageW / 2, y, { align: "center" });
    y += 6;
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/** Schmaler Thermo-Bon-ähnlicher PDF-Streifen (80 mm). */
export async function generatePosGiftVoucherThermalPdf(
  voucher: PosGiftVoucherRow,
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const QRCode = (await import("qrcode")).default;
  const header = await loadRestaurantHeader(voucher.restaurant_id);
  const qrPayload = buildPosGiftVoucherQrPayload(voucher.public_token);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const width = 80;
  const height = 140;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [width, height],
  });

  let y = 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(header.name, width / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("WERTGUTSCHEIN", width / 2, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(formatEuroFromCents(voucher.balance_cents), width / 2, y, {
    align: "center",
  });
  y += 6;
  const qr = 32;
  doc.addImage(qrDataUrl, "PNG", (width - qr) / 2, y, qr, qr);
  y += qr + 6;
  doc.setFontSize(10);
  doc.text(voucher.code, width / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Gültig bis ${formatDateDe(voucher.expires_at)}`, width / 2, y, {
    align: "center",
  });

  return Buffer.from(doc.output("arraybuffer"));
}
