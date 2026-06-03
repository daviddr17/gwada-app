import { escapeHtml, escapeHtmlAttr } from "@/lib/email/escape-html";

export type TransactionalEmailCta = {
  label: string;
  href: string;
};

export type TransactionalEmailLayoutContent = {
  /** `<title>` und optional Logo-Alt */
  brandName: string;
  /** Große Überschrift in der Karte */
  headline: string;
  /** Graue Zeile unter der Überschrift */
  intro?: string | null;
  /** HTML-Fragment: Absätze innerhalb der Karte (bereits escaped/aufbereitet) */
  bodyHtml: string;
  cta?: TransactionalEmailCta | null;
  /** Link-Fallback unter dem Button */
  fallbackLink?: { href: string; label?: string } | null;
  /** Footer unter der Karte */
  footerNote?: string | null;
  preheader?: string | null;
  logoUrl?: string | null;
};

const BODY_FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";

/**
 * Transactional E-Mails — Apple-Mail-inspiriert (Magic Link, Reservierung, Passwort, …).
 */
export function buildTransactionalEmailHtml(
  content: TransactionalEmailLayoutContent,
): string {
  const brandName = escapeHtml(content.brandName);
  const headline = escapeHtml(content.headline);
  const preheader = escapeHtml(
    content.preheader?.trim() ||
      `${content.headline} — ${content.brandName}`,
  );

  const logoBlock = content.logoUrl
    ? `<img src="${escapeHtmlAttr(content.logoUrl)}" alt="${brandName}" width="120" height="36" style="display:block;margin:0 auto;max-width:140px;max-height:40px;width:auto;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<p style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.03em;color:#1d1d1f;text-align:center;">${brandName}</p>`;

  const introBlock = content.intro?.trim()
    ? `<tr>
                  <td style="padding:0 0 28px;font-family:${BODY_FONT};font-size:15px;font-weight:400;line-height:1.5;color:#6e6e73;text-align:center;">
                    ${escapeHtml(content.intro.trim())}
                  </td>
                </tr>`
    : "";

  const cta = content.cta;
  const ctaBlock =
    cta?.href && cta.label
      ? `<tr>
                  <td align="center" style="padding:0 0 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td align="center" style="border-radius:980px;background-color:#1d1d1f;">
                          <a href="${escapeHtmlAttr(cta.href)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${BODY_FONT};font-size:16px;font-weight:500;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:980px;background-color:#1d1d1f;mso-padding-alt:14px 32px;">
                            ${escapeHtml(cta.label)}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
      : "";

  const fallback = content.fallbackLink ?? (cta ? { href: cta.href } : null);
  const fallbackBlock = fallback?.href
    ? `<tr>
                  <td style="padding:0 0 20px;border-top:1px solid #e8e8ed;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:0;font-family:${BODY_FONT};font-size:12px;font-weight:400;line-height:1.45;color:#86868b;text-align:center;">
                    ${fallback.label ? `${escapeHtml(fallback.label)}<br />` : "Button funktioniert nicht? Link in den Browser kopieren:<br />"}
                    <a href="${escapeHtmlAttr(fallback.href)}" target="_blank" style="color:#424245;text-decoration:underline;word-break:break-all;">${escapeHtml(fallback.href)}</a>
                  </td>
                </tr>`
    : "";

  const footerBlock = content.footerNote?.trim()
    ? `<tr>
            <td style="padding:28px 12px 0;font-family:${BODY_FONT};font-size:11px;line-height:1.45;color:#86868b;text-align:center;">
              ${escapeHtml(content.footerNote.trim())}
            </td>
          </tr>`
    : "";

  const bodySection = content.bodyHtml.trim()
    ? `<tr>
                  <td style="padding:0 0 ${ctaBlock || fallbackBlock ? "24px" : "0"};font-family:${BODY_FONT};font-size:15px;font-weight:400;line-height:1.55;color:#1d1d1f;text-align:left;">
                    ${content.bodyHtml}
                  </td>
                </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${headline}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #f5f5f7 !important; }
      .email-card { background-color: #ffffff !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:#f5f5f7;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f5f5f7;opacity:0;">${preheader}&#847;&zwnj;&#847;&zwnj;</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-bg" style="background-color:#f5f5f7;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:48px 20px 56px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:0 0 28px;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td class="email-card" style="background-color:#ffffff;border-radius:20px;padding:40px 36px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 8px;font-family:${BODY_FONT};font-size:22px;font-weight:600;letter-spacing:-0.02em;line-height:1.25;color:#1d1d1f;text-align:center;">
                    ${headline}
                  </td>
                </tr>
                ${introBlock}
                ${bodySection}
                ${ctaBlock}
                ${fallbackBlock}
              </table>
            </td>
          </tr>
          ${footerBlock}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
