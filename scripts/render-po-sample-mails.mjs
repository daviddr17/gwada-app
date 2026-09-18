#!/usr/bin/env node
/**
 * Rendert die beiden Bestellstatus-Beispielmails mit dem echten
 * Transactional-Layout (Logo, Karte, Button, Footer).
 * Ausgabe: <dir>/ordered.html|txt und closed.html|txt
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { buildTransactionalEmailHtml } from "../apps/web/lib/email/transactional-email-layout.ts";
import { escapeHtml } from "../apps/web/lib/email/escape-html.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: render-po-sample-mails.mjs <out-dir>");
  process.exit(1);
}

const ORIGIN = "https://gwada.app";
const brandingRes = await fetch(`${ORIGIN}/api/platform/app-branding`);
if (!brandingRes.ok) {
  console.error(`branding_http_${brandingRes.status}`);
  process.exit(1);
}
const branding = await brandingRes.json();
const appName = typeof branding.appName === "string" && branding.appName.trim()
  ? branding.appName.trim()
  : "gwada";
const logoPath = typeof branding.logoUrl === "string" ? branding.logoUrl.trim() : "";
const logoUrl = logoPath
  ? (logoPath.startsWith("http") ? logoPath : `${ORIGIN}${logoPath.startsWith("/") ? logoPath : `/${logoPath}`}`)
  : null;

const HREF = `${ORIGIN}/dashboard/inventory/bestellung`;
const INTRO = `Du hast eine neue Benachrichtigung in ${appName}.`;
const NOTE = "Beispielmail mit fiktiven Positionen — keine echte Bestellung.";

const ORDERED = `Lieferant: Metro
Lieferdatum: 22.09.2026
Von: David
Positionen:
• Vollmilch 3,5% (Weihenstephan, Art. 10442) — 24 L
• Zucker (Art. 22018) — 10 kg
• Meersalz (Art. 33001) — 2 kg
• Butter — 8 kg`;

const CLOSED = `Lieferant: Metro
Lieferdatum: 22.09.2026
Von: David
Fehlend / abweichend:
• Zucker (Art. 22018) — abweichend (bestellt 10 kg, geliefert 6 kg) · Rest kommt Donnerstag
• Meersalz (Art. 33001) — fehlend (bestellt 2 kg) · nicht auf dem Lieferschein
Positionen:
• Vollmilch 3,5% (Weihenstephan, Art. 10442) — 24 L
• Zucker (Art. 22018) — 10 kg
• Meersalz (Art. 33001) — 2 kg
• Butter — 8 kg`;

function detailsHtml(details) {
  const lines = details
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => escapeHtml(line));
  return `<p style="margin:0 0 14px;">${escapeHtml(NOTE)}</p><p style="margin:0 0 14px;">${lines.join("<br />\n")}</p>`;
}

function render(headline, details) {
  const html = buildTransactionalEmailHtml({
    brandName: appName,
    logoUrl,
    headline,
    intro: INTRO,
    bodyHtml: detailsHtml(details),
    cta: { label: "In Gwada öffnen", href: HREF },
    fallbackLink: { href: HREF },
    footerNote: "Diese Nachricht wurde von SENDER_NAME_TOKEN gesendet.",
    preheader: headline,
  });
  const text = [headline, "", INTRO, "", NOTE, "", details, "", HREF, "", "Diese Nachricht wurde von SENDER_NAME_TOKEN gesendet."].join("\n");
  return { html, text };
}

mkdirSync(dir, { recursive: true });
const orderedHeadline = "Hafengaststätte Zur Schlagd: Bestellung aufgegeben — Metro";
const closedHeadline = "Hafengaststätte Zur Schlagd: Bestellung abgeschlossen — Metro";
const ordered = render(orderedHeadline, ORDERED);
const closed = render(closedHeadline, CLOSED);
writeFileSync(`${dir}/ordered.html`, ordered.html);
writeFileSync(`${dir}/ordered.txt`, ordered.text);
writeFileSync(`${dir}/closed.html`, closed.html);
writeFileSync(`${dir}/closed.txt`, closed.text);
console.log(`rendered app=${appName} logo=${logoUrl ? "yes" : "no"}`);
