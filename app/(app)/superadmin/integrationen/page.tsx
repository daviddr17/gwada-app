"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppleGlyph } from "@/components/icons/apple-glyph";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { IntegrationProviderCard } from "@/components/superadmin/integration-provider-card";
import { fetchPlatformIntegrations } from "@/lib/supabase/platform-superadmin-db";
import type {
  PlatformIntegrationKey,
  PlatformIntegrationRow,
} from "@/lib/types/platform-integration";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const INTEGRATION_META: Record<
  PlatformIntegrationKey,
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
    description: "Social-Integration — folgt in einer späteren Version.",
    icon: <FacebookGlyph />,
    configurable: false,
  },
  instagram: {
    title: "Instagram",
    description: "Social-Integration — folgt in einer späteren Version.",
    icon: <InstagramGlyph />,
    configurable: false,
  },
  whatsapp: {
    title: "WhatsApp",
    description: "Messaging-Integration — folgt in einer späteren Version.",
    icon: <WhatsAppGlyph />,
    configurable: false,
  },
};

const ORDER: PlatformIntegrationKey[] = [
  "google_oauth",
  "apple_oauth",
  "facebook",
  "instagram",
  "whatsapp",
];

export default function SuperadminIntegrationsPage() {
  const [rows, setRows] = useState<PlatformIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchPlatformIntegrations(sb);
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
          OAuth-Provider aktivieren und Zugangsdaten zentral verwalten. Social-
          Kanäle sind vorerst Platzhalter.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground" aria-busy>
          Integrationen werden geladen…
        </p>
      ) : (
        <div className="space-y-4">
          {ORDER.map((key) => {
            const meta = INTEGRATION_META[key];
            const row = byKey.get(key) ?? {
              key,
              enabled: false,
              config: {},
              updated_at: new Date().toISOString(),
            };
            return (
              <IntegrationProviderCard
                key={key}
                title={meta.title}
                description={meta.description}
                icon={meta.icon}
                row={row}
                configurable={meta.configurable}
                onSaved={() => void load()}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
