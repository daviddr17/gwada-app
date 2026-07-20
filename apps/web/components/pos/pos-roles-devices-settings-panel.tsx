"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { AppNavLink } from "@/components/navigation/app-nav-link";

type Capability = {
  key: string;
  labelDe: string;
  descriptionDe: string | null;
};

type Role = {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  capabilityKeys: string[];
};

type Device = {
  id: string;
  name: string;
  kind: "hub" | "handheld";
  enrollmentCodeHint: string | null;
  enrollmentExpiresAt: string | null;
  isActive: boolean;
  isEnrolled: boolean;
};

export function PosRolesDevicesSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [deviceKind, setDeviceKind] = useState<"hub" | "handheld">("handheld");
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pos/devices-roles?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        capabilities?: Capability[];
        roles?: Role[];
        devices?: Device[];
        error?: string;
      };
      if (!res.ok) toast.error(json.error ?? "Laden fehlgeschlagen");
      else {
        setCapabilities(json.capabilities ?? []);
        setRoles(json.roles ?? []);
        setDevices(json.devices ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCap = async (role: Role, key: string) => {
    if (!restaurantId) return;
    const next = role.capabilityKeys.includes(key)
      ? role.capabilityKeys.filter((k) => k !== key)
      : [...role.capabilityKeys, key];
    setSavingRoleId(role.id);
    setRoles((rs) =>
      rs.map((r) => (r.id === role.id ? { ...r, capabilityKeys: next } : r)),
    );
    try {
      const res = await fetch("/api/pos/devices-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          action: "set_role_capabilities",
          roleId: role.id,
          capabilityKeys: next,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen");
        void load();
      }
    } finally {
      setSavingRoleId(null);
    }
  };

  const createEnrollment = async () => {
    if (!restaurantId || !deviceName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/pos/devices-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          action: "create_enrollment",
          name: deviceName.trim(),
          kind: deviceKind,
        }),
      });
      const data = (await res.json()) as {
        enrollmentCode?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Anlegen fehlgeschlagen");
        return;
      }
      setLastCode(data.enrollmentCode ?? null);
      setDeviceName("");
      toast.success("Enrollment-Code erzeugt — nur jetzt sichtbar");
      void load();
    } finally {
      setCreating(false);
    }
  };

  const deactivate = async (deviceId: string) => {
    if (!restaurantId) return;
    const res = await fetch("/api/pos/devices-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        action: "deactivate_device",
        deviceId,
      }),
    });
    if (!res.ok) {
      toast.error("Deaktivieren fehlgeschlagen");
      return;
    }
    toast.success("Gerät deaktiviert");
    void load();
  };

  if (!ready || (!restaurantId && showSkeleton)) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Geräte & Rechte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (ready && !restaurantId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">POS-Rollen & Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Capabilities steuern den Mehr-Tab der Kellner-App. Rollen sind Bundles —
            zuweisbar am Mitarbeiter (`pos_role_id`).
          </p>
          {showSkeleton ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className="rounded-xl border border-border/50 p-3 space-y-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{role.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {role.isSystem ? "System" : "Custom"} · {role.slug}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {capabilities.map((cap) => {
                    const on = role.capabilityKeys.includes(cap.key);
                    return (
                      <label
                        key={cap.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Switch
                          checked={on}
                          disabled={savingRoleId === role.id}
                          onCheckedChange={() => void toggleCap(role, cap.key)}
                        />
                        {cap.labelDe}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Geräte-Enrollment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Code einmal anzeigen, auf dem Gerät eingeben. Danach nur noch Hash in der DB.
          </p>
          {lastCode && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 font-mono text-lg tracking-widest text-center">
              {lastCode}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="device-name">Gerätename</Label>
              <Input
                id="device-name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="iPad Hub Bar / iPhone Fadi"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={deviceKind === "handheld" ? "default" : "outline"}
                  onClick={() => setDeviceKind("handheld")}
                >
                  Handheld
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={deviceKind === "hub" ? "default" : "outline"}
                  onClick={() => setDeviceKind("hub")}
                >
                  Hub
                </Button>
              </div>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className={brandActionButtonRoundedClassName}
                disabled={creating || !deviceName.trim()}
                onClick={() => void createEnrollment()}
              >
                Code erzeugen
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {devices.length === 0 && !showSkeleton && (
              <p className="text-sm text-muted-foreground">Noch keine Geräte.</p>
            )}
            {devices.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2"
              >
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.kind} ·{" "}
                    {d.isEnrolled
                      ? "enrollt"
                      : `Code ${d.enrollmentCodeHint ?? "—"}`}
                    {!d.isActive ? " · inaktiv" : ""}
                  </div>
                </div>
                {d.isActive && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void deactivate(d.id)}
                  >
                    Deaktivieren
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Optionsgruppen (Modifier) pflegst du in der{" "}
        <AppNavLink
          href={APP_ROUTES.menu.overview}
          className="underline underline-offset-2"
        >
          Speisekarte
        </AppNavLink>
        . Beilagen-Preise unten.
      </p>
    </div>
  );
}
