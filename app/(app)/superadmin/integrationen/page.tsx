"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppleGlyph } from "@/components/icons/apple-glyph";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { IntegrationProviderCard } from "@/components/superadmin/integration-provider-card";
import { PlatformEmailSmtpCard } from "@/components/superadmin/platform-email-smtp-card";
import { PlatformWhatsappFeatureCard } from "@/components/superadmin/platform-whatsapp-feature-card";
import { Button } from "@/components/ui/button";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import {
  SuperadminIntegrationsSaveProvider,
  useSuperadminIntegrationsSave,
} from "@/lib/superadmin/integrations-save-registry";
import { fetchSuperadminPlatformIntegrations } from "@/lib/superadmin/platform-integrations-api";
import type {
  PlatformIntegrationKey,
  PlatformIntegrationRow,
} from "@/lib/types/platform-integration";
import { cn } from "@/lib/utils";

const OAUTH_ORDER = [
  "google_oauth",
  "apple_oauth",
  "facebook",
  "instagram",
  "google_business",
] as const satisfies readonly PlatformIntegrationKey[];

const OAUTH_META: Record<
  (typeof OAUTH_ORDER)[number],
  {
    title: string;
    description: string;
    icon: React.ReactNode;
    configurable: boolean;
  }
> = {
  google_oauth: {
    title: "Google OAuth",
    description:
      "Anmeldung und Registrierung mit Google. Secrets werden in der Plattform gespeichert.",
    icon: <GoogleGlyph />,
    configurable: true,
  },
  apple_oauth: {
    title: "Apple Sign In",
    description:
      "Anmeldung mit Apple. Client ID und Secret (JWT) hier pflegen.",
    icon: <AppleGlyph className="text-foreground" />,
    configurable: true,
  },
  facebook: {
    title: "Facebook",
    description:
      "Messenger & Meta-APIs. App-ID und App-Geheimnis aus der Meta Developer Console (developers.facebook.com).",
    icon: <FacebookGlyph />,
    configurable: true,
  },
  instagram: {
    title: "Instagram",
    description:
      "Instagram Business über Meta. App-ID und App-Geheimnis — dieselbe Meta-App wie Facebook möglich.",
    icon: <InstagramGlyph />,
    configurable: true,
  },
  google_business: {
    title: "Google Business Profile",
    description:
      "OAuth für Unternehmensprofile (Bewertungen, Nachrichten, Beiträge). Client ID und Secret aus der Google Cloud Console — Redirect-URI auf der Live-Domain eintragen.",
    icon: <GoogleGlyph />,
    configurable: true,
  },
};

const EMPTY_PLATFORM_ROW: Record<PlatformIntegrationKey, PlatformIntegrationRow> = {
  google_oauth: { key: "google_oauth", enabled: false, config: {}, updated_at: "" },
  apple_oauth: { key: "apple_oauth", enabled: false, config: {}, updated_at: "" },
  facebook: { key: "facebook", enabled: false, config: {}, updated_at: "" },
  instagram: { key: "instagram", enabled: false, config: {}, updated_at: "" },
  google_business: {
    key: "google_business",
    enabled: false,
    config: {},
    updated_at: "",
  },
  whatsapp: { key: "whatsapp", enabled: false, config: {}, updated_at: "" },
  email: {
    key: "email",
    enabled: false,
    config: { email: "contact@gwada.app" },
    updated_at: "",
  },
};

function SuperadminIntegrationsContent() {
  const [rows, setRows] = useState<PlatformIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { dirty, saving, saveAll } = useSuperadminIntegrationsSave();

  const load = useCallback(async () => {
    setLoading(true);
    const { rows: data, error } = await fetchSuperadminPlatformIntegrations();
    if (error) toast.error(error);
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byKey = useMemo(() => {
    const m = new Map<string, PlatformIntegrationRow>();
    for (const r of rows) m.set(r.key, r);
    return m;
  }, [rows]);

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Integrationen</h2>
        <p className="text-sm text-muted-foreground">
          OAuth, WhatsApp (WAHA) und E-Mail — Zugangsdaten nur für Superadmins,
          Versand und API-Calls nur serverseitig.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground" aria-busy>
          Integrationen werden geladen…
        </p>
      ) : (
        <div className="space-y-4">
          <PlatformWhatsappFeatureCard
            row={byKey.get("whatsapp") ?? EMPTY_PLATFORM_ROW.whatsapp}
            onSaved={() => void load()}
          />
          <PlatformEmailSmtpCard
            row={byKey.get("email") ?? EMPTY_PLATFORM_ROW.email}
            onSaved={() => void load()}
          />
          {OAUTH_ORDER.map((key) => {
            const meta = OAUTH_META[key];
            const row = byKey.get(key) ?? EMPTY_PLATFORM_ROW[key];
            return (
              <IntegrationProviderCard
                key={key}
                title={meta.title}
                description={meta.description}
                icon={meta.icon}
                row={row}
                configurable={meta.configurable}
                clientIdLabel={
                  key === "facebook" || key === "instagram"
                    ? "App ID"
                    : key === "google_business"
                      ? "Client ID"
                      : undefined
                }
                clientSecretLabel={
                  key === "facebook" || key === "instagram"
                    ? "App Secret"
                    : key === "google_business"
                      ? "Client Secret"
                      : undefined
                }
                clientIdPlaceholder={
                  key === "facebook" || key === "instagram"
                    ? "z. B. 1234567890123456"
                    : key === "google_business"
                      ? "z. B. 123456789-….apps.googleusercontent.com"
                      : undefined
                }
                onSaved={() => void load()}
              />
            );
          })}
        </div>
      )}

      <SettingsStickySaveBar show={dirty}>
        <Button
          type="button"
          disabled={saving}
          className={cn(
            "h-11 w-full min-w-[12rem] sm:w-auto",
            settingsAccentSaveButtonClassName,
          )}
          onClick={() => void saveAll()}
        >
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </SettingsStickySaveBar>
    </div>
  );
}

export default function SuperadminIntegrationsPage() {
  const [reloadToken, setReloadToken] = useState(0);
  const handleAfterSave = useCallback(async () => {
    setReloadToken((t) => t + 1);
  }, []);

  return (
    <SuperadminIntegrationsSaveProvider onAfterSave={handleAfterSave}>
      <SuperadminIntegrationsContent key={reloadToken} />
    </SuperadminIntegrationsSaveProvider>
  );
}
