import "server-only";

import { fetchTransactionalEmailBranding } from "@/lib/email/fetch-transactional-email-branding";
import {
  buildTransactionalEmailHtmlFromText,
  buildTransactionalEmailTextFromParts,
} from "@/lib/email/transactional-email-from-text";
import { sendViaSmtp, type SmtpSendPayload } from "@/lib/email/send-via-smtp";
import type { EmailSender, EmailSmtpCredentials } from "@/lib/email/email-delivery";

export type ReservationEmailDelivery = {
  sender: EmailSender;
  smtp: EmailSmtpCredentials;
};

export type ReservationEmailPayload = Omit<
  SmtpSendPayload,
  "html" | "fromName"
> & {
  text: string;
  /** Überschrift in der E-Mail-Karte — Standard: Betreff */
  headline?: string | null;
  /** Graue Intro-Zeile unter der Überschrift */
  intro?: string | null;
  /** Fertiges HTML-Fragment für den Karten-Inhalt (statt Plain-Text-Parsing) */
  bodyHtml?: string | null;
  footerNote?: string | null;
  replyTo?: string;
  attachments?: SmtpSendPayload["attachments"];
};

export async function sendReservationEmail(
  delivery: ReservationEmailDelivery,
  payload: ReservationEmailPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const branding = await fetchTransactionalEmailBranding();
  const headline = payload.headline?.trim() || payload.subject.trim();
  const footerNote =
    payload.footerNote?.trim() ||
    (delivery.sender.name
      ? `Diese Nachricht wurde von ${delivery.sender.name} gesendet.`
      : undefined);

  const html = buildTransactionalEmailHtmlFromText({
    brandName: branding.appName,
    logoUrl: branding.logoUrl,
    headline,
    intro: payload.intro,
    text: payload.text,
    bodyHtml: payload.bodyHtml,
    footerNote,
    preheader: payload.subject,
  });

  const text = buildTransactionalEmailTextFromParts({
    headline,
    intro: payload.intro,
    text: payload.text,
    footerNote,
  });

  return sendViaSmtp(delivery.smtp, {
    to: payload.to,
    subject: payload.subject,
    text,
    html,
    fromName: delivery.sender.name,
    replyTo: payload.replyTo,
    attachments: payload.attachments,
  });
}
