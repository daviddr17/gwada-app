import "server-only";

import nodemailer from "nodemailer";
import type { EmailSmtpCredentials } from "@/lib/email/email-delivery";

export type SmtpSendPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromName: string;
};

export async function sendViaSmtp(
  smtp: EmailSmtpCredentials,
  payload: SmtpSendPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost,
    port: smtp.smtpPort,
    secure: smtp.smtpPort === 465,
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
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "smtp_send_failed";
    return { ok: false, error: msg };
  } finally {
    transporter.close();
  }
}
