import {
  buildTransactionalEmailHtml,
  type TransactionalEmailLayoutContent,
} from "@/lib/email/transactional-email-layout";

export type PasswordResetEmailContent = {
  appName: string;
  resetLink: string;
  logoUrl: string | null;
};

export function buildPasswordResetEmailHtml(
  content: PasswordResetEmailContent,
): string {
  const layout: TransactionalEmailLayoutContent = {
    brandName: content.appName,
    logoUrl: content.logoUrl,
    headline: "Passwort zurücksetzen",
    intro: `Du hast ein neues Passwort für ${content.appName} angefordert. Der Link ist nur kurze Zeit gültig.`,
    bodyHtml: "",
    preheader: `Setze dein ${content.appName}-Passwort in wenigen Schritten zurück.`,
    cta: { label: "Passwort zurücksetzen", href: content.resetLink },
    fallbackLink: { href: content.resetLink },
    footerNote: `Wenn du kein neues Passwort angefordert hast, ignoriere diese E-Mail — dein Passwort bleibt unverändert.`,
  };
  return buildTransactionalEmailHtml(layout);
}

export function buildPasswordResetEmailText(
  content: PasswordResetEmailContent,
): string {
  return [
    content.appName,
    "",
    "Passwort zurücksetzen",
    "",
    "Öffne den Link, um ein neues Passwort zu vergeben. Der Link ist nur kurze Zeit gültig.",
    "",
    content.resetLink,
    "",
    "Wenn du das nicht angefordert hast, ignoriere diese E-Mail.",
  ].join("\n");
}
