import {
  buildTransactionalEmailHtml,
  type TransactionalEmailLayoutContent,
} from "@/lib/email/transactional-email-layout";

export type MagicLinkEmailContent = {
  appName: string;
  magicLink: string;
  logoUrl: string | null;
};

export function buildMagicLinkEmailHtml(content: MagicLinkEmailContent): string {
  const layout: TransactionalEmailLayoutContent = {
    brandName: content.appName,
    logoUrl: content.logoUrl,
    headline: `Bei ${content.appName} anmelden`,
    intro:
      "Tippe auf den Button, um dich sicher anzumelden. Der Link ist nur kurze Zeit gültig und funktioniert nur einmal.",
    bodyHtml: "",
    preheader: `Einmal tippen und du bist bei ${content.appName} angemeldet — der Link läuft bald ab.`,
    cta: { label: "Jetzt anmelden", href: content.magicLink },
    fallbackLink: { href: content.magicLink },
    footerNote: `Du hast diese E-Mail angefordert, um dich bei ${content.appName} anzumelden. Wenn du das nicht warst, kannst du diese Nachricht ignorieren.`,
  };
  return buildTransactionalEmailHtml(layout);
}

export function buildMagicLinkEmailText(content: MagicLinkEmailContent): string {
  const lines = [
    content.appName,
    "",
    "Bei " + content.appName + " anmelden",
    "",
    "Tippe auf den Link, um dich sicher anzumelden. Der Link ist nur kurze Zeit gültig.",
    "",
    content.magicLink,
    "",
    "Wenn du diese Anmeldung nicht angefordert hast, ignoriere diese E-Mail.",
  ];
  return lines.join("\n");
}
