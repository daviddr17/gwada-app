"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import {
  SmtpConnectionFields,
  type SmtpConnectionFieldValues,
} from "@/components/integrations/smtp-connection-fields";
import { SuperadminIntegrationPanel } from "@/components/superadmin/superadmin-integration-panel";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { GWADA_DEFAULT_FROM_EMAIL } from "@/lib/constants/gwada-email-defaults";
import { validateSmtpConfigForSave } from "@/lib/integrations/smtp-integration-config";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";

function valuesFromRow(row: PlatformIntegrationRow): SmtpConnectionFieldValues {
  const c = row.config;
  return {
    email: (c.email as string | undefined) ?? GWADA_DEFAULT_FROM_EMAIL,
    password: "",
    smtpHost: (c.smtp_host as string | undefined) ?? "",
    smtpPort: c.smtp_port != null ? String(c.smtp_port) : "",
    imapHost: (c.imap_host as string | undefined) ?? "",
    imapPort: c.imap_port != null ? String(c.imap_port) : "",
    fromName: (c.from_name as string | undefined) ?? "",
  };
}

export function PlatformEmailSmtpCard({
  row,
  onSaved,
}: {
  row: PlatformIntegrationRow;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(row.enabled);
  const [fields, setFields] = useState<SmtpConnectionFieldValues>(() =>
    valuesFromRow(row),
  );
  const passwordConfigured = Boolean(row.config.passwordConfigured);

  const snapshot = useMemo(
    () => JSON.stringify({ enabled: row.enabled, fields: valuesFromRow(row) }),
    [row],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({
      enabled,
      fields: { ...fields, password: "" },
    });
    const base = JSON.stringify({
      enabled: row.enabled,
      fields: { ...valuesFromRow(row), password: "" },
    });
    return current !== base || fields.password.length > 0;
  }, [enabled, fields, row]);

  useEffect(() => {
    setEnabled(row.enabled);
    setFields(valuesFromRow(row));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
    if (enabled) {
      const err = validateSmtpConfigForSave(
        {
          email: fields.email,
          password: fields.password,
          smtp_host: fields.smtpHost,
          smtp_port: fields.smtpPort,
          imap_host: fields.imapHost,
          imap_port: fields.imapPort,
          from_name: fields.fromName,
        },
        { requirePassword: !passwordConfigured && !fields.password.trim() },
      );
      if (err) {
        toast.error(err);
        return;
      }
    }

    const config: Record<string, unknown> = {
      email: fields.email.trim(),
      smtp_host: fields.smtpHost.trim(),
      smtp_port: fields.smtpPort.trim(),
      imap_host: fields.imapHost.trim(),
      imap_port: fields.imapPort.trim(),
      from_name: fields.fromName.trim() || undefined,
    };
    if (fields.password.trim()) {
      config.password = fields.password.trim();
    }

    const { ok, error } = await saveSuperadminPlatformIntegration(
      "email",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("E-Mail-Plattform gespeichert.");
    setFields((f) => ({ ...f, password: "" }));
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("email", dirty, save);

  return (
    <SuperadminIntegrationPanel
      title="E-Mail"
      description={`Fallback-Versand mit ${GWADA_DEFAULT_FROM_EMAIL} — SMTP-Daten nur serverseitig.`}
      icon={<Mail className="text-muted-foreground" />}
      badges={
        enabled ? (
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          >
            Für Nutzer sichtbar
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Ausgeblendet
          </Badge>
        )
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="E-Mail für Nutzer freischalten"
        />
      }
    >
      <SmtpConnectionFields
        idPrefix="platform-email"
        values={fields}
        disabled={!enabled}
        passwordConfigured={passwordConfigured}
        onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
      />
    </SuperadminIntegrationPanel>
  );
}
