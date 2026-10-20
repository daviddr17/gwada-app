"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RegisterModuleSecondarySubnav } from "@/lib/contexts/app-module-chrome-context";
import { POS_SETTINGS_SECONDARY_NAV } from "@/components/pos/pos-settings-secondary-nav";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type {
  DeliveryZone,
  OnlineOrderingSettings,
} from "@/lib/ordering/online-ordering-types";
import { Skeleton } from "@/components/ui/skeleton";

function eurosFromCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function centsFromEuroInput(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function PosSettingsOnlineOrderingScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [settings, setSettings] = useState<OnlineOrderingSettings | null>(null);
  const [draft, setDraft] = useState<OnlineOrderingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zonesText, setZonesText] = useState("");
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/ordering/settings?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        const json = (await res.json()) as {
          settings?: OnlineOrderingSettings;
          error?: string;
        };
        if (!res.ok || !json.settings) {
          toast.error(json.error ?? "Einstellungen laden fehlgeschlagen");
          return;
        }
        if (cancelled) return;
        setSettings(json.settings);
        setDraft(json.settings);
        setZonesText(formatZones(json.settings.deliveryZones));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const dirty = useMemo(() => {
    if (!settings || !draft) return false;
    return (
      JSON.stringify(settings) !== JSON.stringify(draft) ||
      zonesText !== formatZones(settings.deliveryZones)
    );
  }, [settings, draft, zonesText]);

  async function save() {
    if (!restaurantId || !draft) return;
    setSaving(true);
    try {
      const zones = parseZonesText(zonesText);
      const payload = { ...draft, deliveryZones: zones, restaurantId };
      const res = await fetch("/api/ordering/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        settings?: OnlineOrderingSettings;
        error?: string;
      };
      if (!res.ok || !json.settings) {
        toast.error(json.error ?? "Speichern fehlgeschlagen");
        return;
      }
      setSettings(json.settings);
      setDraft(json.settings);
      setZonesText(formatZones(json.settings.deliveryZones));
      toast.success("Gespeichert");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <>
      <RegisterModuleSecondarySubnav
        ariaLabel="POS-Einstellungen"
        items={POS_SETTINGS_SECONDARY_NAV}
      />
      {showSkeleton || !draft ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6 pb-24">
          <Card className="border-border/50 shadow-card">
            <CardContent className="space-y-4 pt-6">
              <ToggleRow
                label="Online-Bestellung (Web)"
                description="Öffentliche Seite /order/[slug] — Lieferando-ähnlich."
                checked={draft.onlineEnabled}
                onCheckedChange={(v) =>
                  setDraft({ ...draft, onlineEnabled: v })
                }
              />
              <ToggleRow
                label="Kiosk / Tisch-Self-Order"
                description="Locked Shell /kiosk/[slug] für Android-Counter und iPad am Tisch."
                checked={draft.kioskEnabled}
                onCheckedChange={(v) =>
                  setDraft({ ...draft, kioskEnabled: v })
                }
              />
              <ToggleRow
                label="Abholung"
                checked={draft.pickupEnabled}
                onCheckedChange={(v) =>
                  setDraft({ ...draft, pickupEnabled: v })
                }
              />
              <ToggleRow
                label="Lieferung"
                checked={draft.deliveryEnabled}
                onCheckedChange={(v) =>
                  setDraft({ ...draft, deliveryEnabled: v })
                }
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardContent className="space-y-4 pt-6">
              <EuroField
                label="Mindestbestellwert Abholung (€)"
                value={eurosFromCents(draft.minOrderCentsPickup)}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    minOrderCentsPickup: centsFromEuroInput(v),
                  })
                }
              />
              <EuroField
                label="Mindestbestellwert Lieferung (€)"
                value={eurosFromCents(draft.minOrderCentsDelivery)}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    minOrderCentsDelivery: centsFromEuroInput(v),
                  })
                }
              />
              <EuroField
                label="Standard-Liefergebühr (€)"
                value={eurosFromCents(draft.deliveryFeeCents)}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    deliveryFeeCents: centsFromEuroInput(v),
                  })
                }
              />
              <div className="space-y-1.5">
                <Label>Lieferzonen (PLZ)</Label>
                <Textarea
                  value={zonesText}
                  onChange={(e) => setZonesText(e.target.value)}
                  rows={4}
                  placeholder={"20095;2,50;15\n20099;3,00;20"}
                />
                <p className="text-xs text-muted-foreground">
                  Eine Zeile pro PLZ:{" "}
                  <code>PLZ;Gebühr€;Mindest€</code> — Gebühr/Mindest optional.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  label="Vorlauf Abholung (Min.)"
                  value={draft.pickupLeadMinutes}
                  onChange={(n) =>
                    setDraft({ ...draft, pickupLeadMinutes: n })
                  }
                />
                <NumberField
                  label="Vorlauf Lieferung (Min.)"
                  value={draft.deliveryLeadMinutes}
                  onChange={(n) =>
                    setDraft({ ...draft, deliveryLeadMinutes: n })
                  }
                />
              </div>
              <NumberField
                label="Kiosk Idle-Reset (Sek.)"
                value={draft.kioskIdleSeconds}
                onChange={(n) =>
                  setDraft({
                    ...draft,
                    kioskIdleSeconds: Math.max(30, n),
                  })
                }
              />
              <div className="space-y-1.5">
                <Label>Hinweis auf Status-Seite</Label>
                <Textarea
                  value={draft.guestStatusMessage ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      guestStatusMessage: e.target.value || null,
                    })
                  }
                  rows={2}
                  placeholder="z. B. Bitte an der Theke melden."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardContent className="space-y-4 pt-6">
              <p className="font-medium">Gast-Benachrichtigungen</p>
              <ToggleRow
                label="WhatsApp (WAHA)"
                description="Statuswechsel an Gast-Telefon (wenn hinterlegt)."
                checked={draft.notifyWhatsappEnabled}
                onCheckedChange={(v) =>
                  setDraft({ ...draft, notifyWhatsappEnabled: v })
                }
              />
              <ToggleRow
                label="E-Mail"
                description="Statuswechsel an Gast-E-Mail (Restaurant-/Plattform-SMTP)."
                checked={draft.notifyEmailEnabled}
                onCheckedChange={(v) =>
                  setDraft({ ...draft, notifyEmailEnabled: v })
                }
              />
              <p className="text-xs text-muted-foreground">
                Status-URL bleibt immer verfügbar. Benachrichtigt wird u. a. bei
                Angenommen, Zubereitung, Abholbereit, In Lieferung, Geliefert,
                Storniert.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardContent className="space-y-4 pt-6">
              <ToggleRow
                label="Zeitslots"
                description="Gast wählt Abhol-/Lieferfenster; Kapazität pro Slot."
                checked={draft.timeslotsEnabled}
                onCheckedChange={(v) =>
                  setDraft({ ...draft, timeslotsEnabled: v })
                }
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberField
                  label="Intervall (Min.)"
                  value={draft.slotIntervalMinutes}
                  onChange={(n) =>
                    setDraft({
                      ...draft,
                      slotIntervalMinutes: Math.min(120, Math.max(5, n)),
                    })
                  }
                />
                <NumberField
                  label="Kapazität / Slot"
                  value={draft.slotCapacity}
                  onChange={(n) =>
                    setDraft({
                      ...draft,
                      slotCapacity: Math.min(200, Math.max(1, n)),
                    })
                  }
                />
                <NumberField
                  label="Horizont (Std.)"
                  value={draft.slotHorizonHours}
                  onChange={(n) =>
                    setDraft({
                      ...draft,
                      slotHorizonHours: Math.min(168, Math.max(1, n)),
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardContent className="space-y-4 pt-6">
              <p className="font-medium">Kiosk-Terminal (Mollie POS)</p>
              <div className="space-y-1.5">
                <Label>Terminal-ID (term_…)</Label>
                <Input
                  value={draft.kioskMollieTerminalId ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      kioskMollieTerminalId: e.target.value.trim() || null,
                    })
                  }
                  placeholder="term_…"
                />
                <p className="text-xs text-muted-foreground">
                  Counter-Kiosk zahlt per Mollie{" "}
                  <code>pointofsale</code>. Liste unter POS-Geräte / Mollie
                  Terminals. Ohne ID: Fallback auf Hosted Checkout (Fehler am
                  Counter).
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Kiosk-Gerät einrichten (MDM)
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  Counter (Android Lock Task): URL{" "}
                  <code className="text-foreground">/kiosk/{`{slug}`}</code>{" "}
                  (Sunmi, PAX, Elo, …).
                </li>
                <li>
                  Tisch (iPad Single App Mode):{" "}
                  <code className="text-foreground">
                    /kiosk/{`{slug}`}/table/{`{tableId}`}
                  </code>
                  .
                </li>
                <li>
                  Online:{" "}
                  <code className="text-foreground">/order/{`{slug}`}</code>
                </li>
                <li>
                  Staff-Exit: 5× „Gwada Kiosk“ → Display-PIN.
                </li>
              </ul>
              <p>
                Beispiel-Payloads (Apple Configurator / Android Enterprise): siehe
                Projekt-Doku{" "}
                <span className="text-foreground">
                  docs/kiosk-mdm-setup.md
                </span>
                . Web allein sperrt Home/Recents nicht — Gerät-Lock ist Pflicht.
              </p>
            </CardContent>
          </Card>

          <SettingsStickySaveBar show={dirty}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!settings) return;
                setDraft(settings);
                setZonesText(formatZones(settings.deliveryZones));
              }}
            >
              Verwerfen
            </Button>
            <Button
              type="button"
              className={settingsAccentSaveButtonClassName}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Speichern …" : "Speichern"}
            </Button>
          </SettingsStickySaveBar>
        </div>
      )}
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-medium">{label}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function EuroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
      />
    </div>
  );
}

function formatZones(zones: DeliveryZone[]): string {
  return zones
    .map((z) => {
      const parts = [z.postalCode];
      if (z.feeCents != null) parts.push(eurosFromCents(z.feeCents));
      if (z.minOrderCents != null) parts.push(eurosFromCents(z.minOrderCents));
      return parts.join(";");
    })
    .join("\n");
}

function parseZonesText(text: string): DeliveryZone[] {
  const out: DeliveryZone[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [postal, fee, min] = trimmed.split(";").map((s) => s.trim());
    if (!postal) continue;
    out.push({
      postalCode: postal.replace(/\s+/g, ""),
      ...(fee ? { feeCents: centsFromEuroInput(fee) } : {}),
      ...(min ? { minOrderCents: centsFromEuroInput(min) } : {}),
    });
  }
  return out;
}
