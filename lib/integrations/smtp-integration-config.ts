export type SmtpIntegrationConfig = {
  email?: string;
  password?: string;
  smtp_host?: string;
  smtp_port?: string | number;
  imap_host?: string;
  imap_port?: string | number;
  from_name?: string;
  /** @deprecated use email */
  from_email?: string;
};

export type SmtpIntegrationConfigPublic = Omit<
  SmtpIntegrationConfig,
  "password"
> & {
  passwordConfigured?: boolean;
};

export function smtpConfigFromJson(raw: unknown): SmtpIntegrationConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  const port = (k: string) => {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
    if (typeof v === "string" && v.trim()) return v.trim();
    return undefined;
  };
  return {
    email: str("email") ?? str("from_email"),
    password: typeof o.password === "string" ? o.password : undefined,
    smtp_host: str("smtp_host"),
    smtp_port: port("smtp_port"),
    imap_host: str("imap_host"),
    imap_port: port("imap_port"),
    from_name: str("from_name"),
    from_email: str("from_email"),
  };
}

export function smtpConfigToPublic(
  config: SmtpIntegrationConfig,
): SmtpIntegrationConfigPublic {
  const { password, from_email: _fe, ...rest } = config;
  return {
    ...rest,
    passwordConfigured: Boolean(password?.length),
  };
}

export function mergeSmtpPassword(
  incoming: string | undefined,
  existing: SmtpIntegrationConfig,
): string | undefined {
  const next = incoming?.trim();
  if (next) return next;
  return existing.password;
}

export function smtpCredentialsFromConfig(
  config: SmtpIntegrationConfig,
): {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
} | null {
  const email = config.email?.trim();
  const password = config.password?.trim();
  const smtpHost = config.smtp_host?.trim();
  const smtpPortRaw = config.smtp_port;
  const imapHost = config.imap_host?.trim();
  const imapPortRaw = config.imap_port;

  const smtpPort =
    typeof smtpPortRaw === "number"
      ? smtpPortRaw
      : Number.parseInt(String(smtpPortRaw ?? ""), 10);
  const imapPort =
    typeof imapPortRaw === "number"
      ? imapPortRaw
      : Number.parseInt(String(imapPortRaw ?? ""), 10);

  if (
    !email ||
    !password ||
    !smtpHost ||
    !Number.isFinite(smtpPort) ||
    !imapHost ||
    !Number.isFinite(imapPort)
  ) {
    return null;
  }

  return {
    email,
    password,
    smtpHost,
    smtpPort,
    imapHost,
    imapPort,
  };
}

/** @deprecated Alias — use smtpCredentialsFromConfig */
export const smtpConfigForN8n = smtpCredentialsFromConfig;

export function validateSmtpConfigForSave(
  config: SmtpIntegrationConfig,
  options: { requirePassword: boolean },
): string | null {
  if (!config.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email.trim())) {
    return "Gültige E-Mail-Adresse erforderlich.";
  }
  if (options.requirePassword && !config.password?.trim()) {
    return "Passwort erforderlich.";
  }
  if (!config.smtp_host?.trim()) return "SMTP-Server erforderlich.";
  if (!config.smtp_port) return "SMTP-Port erforderlich.";
  if (!config.imap_host?.trim()) return "IMAP-Server erforderlich.";
  if (!config.imap_port) return "IMAP-Port erforderlich.";
  return null;
}
