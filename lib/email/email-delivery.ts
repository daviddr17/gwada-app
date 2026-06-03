import {
  GWADA_DEFAULT_FROM_EMAIL,
  GWADA_DEFAULT_FROM_NAME,
} from "@/lib/constants/gwada-email-defaults";

export type EmailSender = {
  mode: "default" | "custom";
  email: string;
  name: string;
};

/** SMTP/IMAP-Zugangsdaten für direkten Versand aus der App (nodemailer). */
export type EmailSmtpCredentials = {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
};

export function resolveEmailSender(params: {
  useCustom: boolean;
  fromEmail?: string | null;
  fromName?: string | null;
  restaurantFallbackName?: string | null;
}): EmailSender {
  const email = params.fromEmail?.trim();
  const name =
    params.fromName?.trim() ||
    params.restaurantFallbackName?.trim() ||
    GWADA_DEFAULT_FROM_NAME;

  if (params.useCustom && email) {
    return { mode: "custom", email, name };
  }

  return {
    mode: "default",
    email: GWADA_DEFAULT_FROM_EMAIL,
    name: GWADA_DEFAULT_FROM_NAME,
  };
}
