import { GWADA_PRODUCTION_ORIGIN } from "@/lib/constants/gwada-domains";
import { escapeHtml, escapeHtmlAttr } from "@/lib/email/escape-html";
import { getPublicSiteUrl } from "@/lib/public-env";

const PLATFORM_ICON_PATH: Record<string, string> = {
  gwada: "/email/platform-icons/gwada.svg",
  google: "/email/platform-icons/google.svg",
  facebook: "/email/platform-icons/facebook.svg",
  whatsapp: "/email/platform-icons/whatsapp.svg",
  email: "/email/platform-icons/email.svg",
  instagram: "/email/platform-icons/instagram.svg",
};

const PLATFORM_LABEL_TO_CODE: Record<string, string> = {
  Gwada: "gwada",
  Google: "google",
  Facebook: "facebook",
  WhatsApp: "whatsapp",
  "E-Mail": "email",
  Instagram: "instagram",
};

function platformIconAbsoluteUrl(platformCode: string): string | null {
  const path = PLATFORM_ICON_PATH[platformCode.toLowerCase()];
  if (!path) return null;
  const base =
    getPublicSiteUrl()?.replace(/\/$/, "") ?? GWADA_PRODUCTION_ORIGIN;
  return `${base}${path}`;
}

function platformIconImgHtml(platformCode: string): string {
  const iconUrl = platformIconAbsoluteUrl(platformCode);
  if (!iconUrl) return "";
  return `<img src="${escapeHtmlAttr(iconUrl)}" alt="" width="16" height="16" style="display:inline-block;vertical-align:-3px;width:16px;height:16px;margin-right:6px;border:0;" />`;
}

function kanalLineHtml(line: string, platformCode?: string | null): string {
  const match = line.match(/^Kanal:\s*(.+)$/);
  if (!match) return escapeHtml(line);

  const label = match[1].trim();
  const code =
    platformCode?.trim().toLowerCase() ||
    PLATFORM_LABEL_TO_CODE[label] ||
    label.toLowerCase();
  const iconHtml = platformIconImgHtml(code);
  return `Kanal: ${iconHtml}${escapeHtml(label)}`;
}

/** HTML-Body für Push-E-Mails — ohne doppelte Überschrift, mit Plattform-Icon bei Kanal-Zeilen. */
export function buildPushNotificationEmailBodyHtml(
  details: string,
  platformCode?: string | null,
): string {
  const lines = details
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return "";

  const inner = lines
    .map((line) => {
      if (line.startsWith("Kanal:")) {
        return kanalLineHtml(line, platformCode);
      }
      return escapeHtml(line);
    })
    .join("<br />\n");

  return `<p style="margin:0 0 14px;">${inner}</p>`;
}
