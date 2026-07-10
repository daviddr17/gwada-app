import "server-only";

import nodemailer from "nodemailer";
import type { EmailSmtpCredentials } from "@/lib/email/email-delivery";

export type SmtpAttachmentPart = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type SmtpSendPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromName: string;
  replyTo?: string;
  attachments?: SmtpAttachmentPart[];
};

export async function sendViaSmtp(
  smtp: EmailSmtpCredentials,
  payload: SmtpSendPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost,
    port: smtp.smtpPort,
    secure: smtp.smtpPort === 465,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
    auth: {
      user: smtp.email,
      pass: smtp.password,
    },
  });

  try {
    await transporter.sendMail({
      from: {
        name: payload.fromName,
        address: smtp.email,
      },
      to: payload.to,
      replyTo: payload.replyTo,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "smtp_send_failed";
    return { ok: false, error: msg };
  } finally {
    transporter.close();
  }
}
