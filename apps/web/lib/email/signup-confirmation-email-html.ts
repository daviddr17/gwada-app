import {
  buildTransactionalEmailHtml,
  type TransactionalEmailLayoutContent,
} from "@/lib/email/transactional-email-layout";

export type SignupConfirmationEmailContent = {
  appName: string;
  confirmLink: string;
  logoUrl: string | null;
};

export function buildSignupConfirmationEmailHtml(
  content: SignupConfirmationEmailContent,
): string {
  const layout: TransactionalEmailLayoutContent = {
    brandName: content.appName,
    logoUrl: content.logoUrl,
    headline: "E-Mail-Adresse bestätigen",
    intro:
      "Bitte tippe auf den Button, um dein Konto zu aktivieren. Danach kannst du die Restaurant-Einladung annehmen.",
    bodyHtml: "",
    preheader: `Bestätige deine E-Mail für ${content.appName}, um die Einladung abzuschließen.`,
    cta: { label: "E-Mail bestätigen", href: content.confirmLink },
    fallbackLink: { href: content.confirmLink },
    footerNote:
      "Du hast dich über eine Restaurant-Einladung registriert. Wenn du das nicht warst, kannst du diese Nachricht ignorieren.",
  };
  return buildTransactionalEmailHtml(layout);
}

export function buildSignupConfirmationEmailText(
  content: SignupConfirmationEmailContent,
): string {
  return [
    content.appName,
    "",
    "E-Mail-Adresse bestätigen",
    "",
    "Bitte öffne den Link, um dein Konto zu aktivieren. Danach kannst du die Restaurant-Einladung annehmen.",
    "",
    content.confirmLink,
    "",
    "Wenn du dich nicht registriert hast, ignoriere diese E-Mail.",
  ].join("\n");
}
