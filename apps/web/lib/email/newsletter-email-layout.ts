import { escapeHtml, escapeHtmlAttr } from "@/lib/email/escape-html";

export type NewsletterEmailBlock = {
  heading: string;
  body: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

export type NewsletterEmailContent = {
  brandName: string;
  logoUrl?: string | null;
  subject: string;
  preheader?: string | null;
  blocks: NewsletterEmailBlock[];
  unsubscribeUrl: string;
  unsubscribeLabel: string;
  footerNote?: string | null;
  lang?: string;
};

const BODY_FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";

function paragraphsHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n{2,}/)
    .map((p) => {
      const lines = escapeHtml(p).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 14px;font-family:${BODY_FONT};font-size:16px;font-weight:400;line-height:1.6;color:#1d1d1f;">${lines}</p>`;
    })
    .join("");
}

/**
 * Marketing-Newsletter — hell, vollbreit, abschnittsweise (Apple/OpenAI-Stil),
 * bewusst anders als die kompakte Transaktionskarte.
 */
export function buildNewsletterEmailHtml(
  content: NewsletterEmailContent,
): string {
  const brandName = escapeHtml(content.brandName);
  const subject = escapeHtml(content.subject);
  const preheader = escapeHtml(
    content.preheader?.trim() || content.subject,
  );
  const lang = escapeHtmlAttr(content.lang?.trim() || "de");

  const logoBlock = content.logoUrl
    ? `<img src="${escapeHtmlAttr(content.logoUrl)}" alt="${brandName}" width="112" style="display:block;max-width:112px;height:auto;border:0;" />`
    : `<span style="font-family:${BODY_FONT};font-size:20px;font-weight:600;letter-spacing:-0.03em;color:#1d1d1f;">${brandName}</span>`;

  const blocksHtml = content.blocks
    .map((block, index) => {
      const heading = block.heading.trim();
      const bodyHtml = paragraphsHtml(block.body);
      const img =
        block.imageUrl?.trim() ?
          `<tr>
            <td style="padding:0 0 20px;">
              <img src="${escapeHtmlAttr(block.imageUrl)}" alt="${escapeHtmlAttr(block.imageAlt?.trim() || heading || "Bild")}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:16px;" />
            </td>
          </tr>`
        : "";
      const headingBlock = heading
        ? `<tr>
            <td style="padding:0 0 10px;font-family:${BODY_FONT};font-size:22px;font-weight:600;letter-spacing:-0.025em;line-height:1.25;color:#1d1d1f;">
              ${escapeHtml(heading)}
            </td>
          </tr>`
        : "";
      const padTop = index === 0 ? "0" : "36px";
      return `<tr>
            <td style="padding:${padTop} 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${img}
                ${headingBlock}
                <tr>
                  <td style="padding:0;">
                    ${bodyHtml || "&nbsp;"}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
    })
    .join("");

  const footerNote = content.footerNote?.trim()
    ? `<p style="margin:0 0 12px;font-family:${BODY_FONT};font-size:12px;line-height:1.45;color:#86868b;">${escapeHtml(content.footerNote.trim())}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${subject}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .nl-bg { background-color: #f5f5f7 !important; }
      .nl-card { background-color: #ffffff !important; }
    }
  </style>
</head>
<body class="nl-bg" style="margin:0;padding:0;background-color:#f5f5f7;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="nl-bg" style="border-collapse:collapse;background-color:#f5f5f7;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 8px 28px;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td class="nl-card" style="background-color:#ffffff;border-radius:22px;padding:36px 32px 40px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${blocksHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 12px 0;text-align:center;">
              ${footerNote}
              <p style="margin:0;font-family:${BODY_FONT};font-size:12px;line-height:1.45;color:#86868b;">
                <a href="${escapeHtmlAttr(content.unsubscribeUrl)}" target="_blank" style="color:#6e6e73;text-decoration:underline;">${escapeHtml(content.unsubscribeLabel)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildNewsletterEmailText(content: NewsletterEmailContent): string {
  const parts: string[] = [content.subject, ""];
  for (const block of content.blocks) {
    if (block.heading.trim()) parts.push(block.heading.trim(), "");
    if (block.body.trim()) parts.push(block.body.trim(), "");
  }
  parts.push("---", `${content.unsubscribeLabel}: ${content.unsubscribeUrl}`);
  return parts.join("\n");
}
