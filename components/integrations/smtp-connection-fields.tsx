"use client";

import { SecretInput } from "@/components/ui/secret-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SmtpConnectionFieldValues = {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: string;
  imapHost: string;
  imapPort: string;
  fromName: string;
};

type Props = {
  idPrefix: string;
  values: SmtpConnectionFieldValues;
  disabled?: boolean;
  passwordConfigured?: boolean;
  showFromName?: boolean;
  onChange: (patch: Partial<SmtpConnectionFieldValues>) => void;
};

export function SmtpConnectionFields({
  idPrefix,
  values,
  disabled,
  passwordConfigured,
  showFromName = true,
  onChange,
}: Props) {
  const field = (name: keyof SmtpConnectionFieldValues, label: string, opts?: {
    type?: string;
    placeholder?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  }) => (
    <div className="space-y-1.5" key={name}>
      <Label htmlFor={`${idPrefix}-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`${idPrefix}-${name}`}
        type={opts?.type ?? "text"}
        inputMode={opts?.inputMode}
        disabled={disabled}
        value={values[name]}
        onChange={(e) => onChange({ [name]: e.target.value })}
        placeholder={opts?.placeholder}
        className="h-11 rounded-xl font-mono text-sm"
        spellCheck={false}
        autoComplete={name === "password" ? "new-password" : "off"}
      />
    </div>
  );

  return (
    <div className="grid gap-3">
      {field("email", "E-Mail", {
        type: "email",
        placeholder: "contact@gwada.app",
      })}
      <SecretInput
        id={`${idPrefix}-password`}
        label="Passwort"
        disabled={disabled}
        configured={passwordConfigured}
        value={values.password}
        onChange={(password) => onChange({ password })}
      />
      {field("smtpHost", "SMTP-Server", { placeholder: "smtp.example.com" })}
      {field("smtpPort", "SMTP-Port", {
        inputMode: "numeric",
        placeholder: "587",
      })}
      {field("imapHost", "IMAP-Server", { placeholder: "imap.example.com" })}
      {field("imapPort", "IMAP-Port", {
        inputMode: "numeric",
        placeholder: "993",
      })}
      {showFromName
        ? field("fromName", "Absender-Name (optional)", {
            placeholder: "Gwada",
          })
        : null}
    </div>
  );
}
