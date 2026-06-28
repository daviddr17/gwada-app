import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

/** QR-Code als PNG-Data-URL für Editor + PDF-Export. */
export async function generateBusinessCardQrDataUrl(
  url: string,
  accentHex?: string,
): Promise<string | null> {
  const target = url.trim();
  if (!target) return null;

  try {
    const QRCode = (await import("qrcode")).default;
    const dark = normalizeHex(accentHex ?? DEFAULT_ACCENT_HEX) ?? DEFAULT_ACCENT_HEX;
    return await QRCode.toDataURL(target, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: {
        dark,
        light: "#ffffff",
      },
    });
  } catch {
    return null;
  }
}
