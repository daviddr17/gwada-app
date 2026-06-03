import { escapeHtml } from "@/lib/email/escape-html";
import {
  buildTransactionalEmailHtml,
  type TransactionalEmailLayoutContent,
} from "@/lib/email/transactional-email-layout";

const URL_RE = /^https?:\/\/\S+$/i;

export type PlainTextEmailParseResult = {
  paragraphs: string[];
  ctaUrl: string | null;
  ctaLabel: string | null;
};

/** Erkennt eine einzelne URL-Zeile und optionales Label in der Zeile davor. */
export function parsePlainTextEmailBody(text: string): PlainTextEmailParseResult {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const blocks = normalized.split(/\n\n+/);
  const paragraphs: string[] = [];
  let ctaUrl: string | null = null;
  let ctaLabel: string | null = null;

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const trimmedLines = lines.map((l) => l.trim()).filter(Boolean);
    if (trimmedLines.length === 0) continue;

    const last = trimmedLines[trimmedLines.length - 1];
    if (URL_RE.test(last) && trimmedLines.length >= 1) {
      const url = last;
      const before = trimmedLines.slice(0, -1).join("\n").trim();
      if (before) paragraphs.push(before);
      if (!ctaUrl) {
        ctaUrl = url;
        ctaLabel = inferCtaLabel(before, url);
      } else {
        paragraphs.push(block.trim());
      }
      continue;
    }

    paragraphs.push(block.trim());
  }

  return { paragraphs, ctaUrl, ctaLabel };
}

function inferCtaLabel(labelLine: string, url: string): string {
  const lower = labelLine.toLowerCase();
  if (/reservierung.*ändern|ändern.*reservierung|✏️/.test(lower)) {
    return "Reservierung verwalten";
  }
  if (/einladung|registrieren|beitreten/.test(lower)) {
    return "Einladung annehmen";
  }
  if (/passwort|zurücksetzen|reset/.test(lower)) {
    return "Passwort zurücksetzen";
  }
  if (/anmelden|login|magic/.test(lower)) {
    return "Jetzt anmelden";
  }
  if (/\/einladung\//i.test(url)) {
    return "Einladung annehmen";
  }
  return "Link öffnen";
}

function paragraphToHtml(paragraph: string): string {
  const lines = paragraph.split("\n");
  const inner = lines.map((line) => escapeHtml(line)).join("<br />\n");
  return `<p style="margin:0 0 14px;">${inner}</p>`;
}

export function buildBodyHtmlFromParagraphs(paragraphs: string[]): string {
  const filtered = paragraphs.map((p) => p.trim()).filter(Boolean);
  if (filtered.length === 0) return "";
  return filtered.map(paragraphToHtml).join("\n");
}

export type TransactionalEmailFromTextParams = {
  brandName: string;
  logoUrl?: string | null;
  headline: string;
  intro?: string | null;
  text: string;
  cta?: { label: string; href: string } | null;
  footerNote?: string | null;
  preheader?: string | null;
};

export function buildTransactionalEmailHtmlFromText(
  params: TransactionalEmailFromTextParams,
): string {
  const parsed = parsePlainTextEmailBody(params.text);
  const ctaHref = params.cta?.href ?? parsed.ctaUrl;
  const ctaLabel = params.cta?.label ?? parsed.ctaLabel;

  const layout: TransactionalEmailLayoutContent = {
    brandName: params.brandName,
    headline: params.headline,
    intro: params.intro,
    bodyHtml: buildBodyHtmlFromParagraphs(parsed.paragraphs),
    logoUrl: params.logoUrl,
    preheader: params.preheader,
    footerNote: params.footerNote,
    cta:
      ctaHref && ctaLabel
        ? { href: ctaHref, label: ctaLabel }
        : null,
    fallbackLink: ctaHref ? { href: ctaHref } : null,
  };

  return buildTransactionalEmailHtml(layout);
}

export function buildTransactionalEmailTextFromParts(params: {
  headline: string;
  intro?: string | null;
  text: string;
  footerNote?: string | null;
}): string {
  const lines = [
    params.headline,
    "",
    ...(params.intro?.trim() ? [params.intro.trim(), ""] : []),
    params.text.trim(),
    "",
    ...(params.footerNote?.trim() ? [params.footerNote.trim()] : []),
  ];
  return lines.join("\n");
}
