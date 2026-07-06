"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import type { RestaurantApiKeyRow } from "@/lib/api/restaurant-api-keys-server";
import {
  RESTAURANT_API_MODULES,
  type RestaurantApiModuleId,
} from "@/lib/api/restaurant-api-modules";
import { restaurantPublicApiBaseUrl } from "@/components/embed/embed-api-info-card";
import { RESTAURANT_API_RATE_LIMIT_PER_MINUTE } from "@/lib/api/restaurant-api-rate-limit";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RestaurantApiKeysPanel() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("settings.api");

  const [keys, setKeys] = useState<RestaurantApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading || permLoading);
  const initialLoadPendingRef = useRef(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [domainsText, setDomainsText] = useState("");
  const [selectedModules, setSelectedModules] = useState<RestaurantApiModuleId[]>(
    RESTAURANT_API_MODULES.map((m) => m.id),
  );

  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const apiBase = useMemo(() => {
    if (typeof window === "undefined") return "https://gwada.app/api/v1";
    return restaurantPublicApiBaseUrl(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setKeys([]);
      setLoading(false);
      initialLoadPendingRef.current = false;
      return;
    }
    const isInitial = initialLoadPendingRef.current;
    if (isInitial) setLoading(true);
    try {
      const res = await fetch(
        `/api/restaurant/api-keys?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      const data = (await res.json()) as {
        keys?: RestaurantApiKeyRow[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "API-Schlüssel konnten nicht geladen werden.");
        if (isInitial) setKeys([]);
        return;
      }
      setKeys(data.keys ?? []);
    } finally {
      if (isInitial) {
        setLoading(false);
        initialLoadPendingRef.current = false;
      }
    }
  }, [restaurantId]);

  useEffect(() => {
    initialLoadPendingRef.current = true;
    setLoading(true);
    void load();
  }, [load]);

  const toggleModule = (id: RestaurantApiModuleId, checked: boolean) => {
    setSelectedModules((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((m) => m !== id);
    });
  };

  const resetCreateForm = () => {
    setName("");
    setDomainsText("");
    setSelectedModules(RESTAURANT_API_MODULES.map((m) => m.id));
  };

  const createKey = async () => {
    if (!restaurantId || creating) return;
    setCreating(true);
    try {
      const allowedOrigins = domainsText
        .split(/[\n,;]+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const res = await fetch("/api/restaurant/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name,
          enabledModules: selectedModules,
          allowedOrigins,
        }),
      });
      const data = (await res.json()) as {
        secret?: string;
        error?: string;
      };
      if (!res.ok || !data.secret) {
        toast.error(
          data.error === "modules_required"
            ? "Mindestens ein Modul auswählen."
            : data.error === "invalid_name"
              ? "Bitte einen Namen vergeben."
              : "Schlüssel konnte nicht erstellt werden.",
        );
        return;
      }
      setCreateOpen(false);
      resetCreateForm();
      setCreatedSecret(data.secret);
      setSecretDialogOpen(true);
      toast.success("API-Schlüssel erstellt.");
      void load();
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!restaurantId) return;
    const res = await fetch(
      `/api/restaurant/api-keys/${encodeURIComponent(keyId)}?restaurantId=${encodeURIComponent(restaurantId)}`,
      { method: "DELETE" },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Widerruf fehlgeschlagen.");
      return;
    }
    toast.success("Schlüssel widerrufen.");
    void load();
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      toast.success("Schlüssel kopiert.");
    } catch {
      toast.error("Kopieren fehlgeschlagen.");
    }
  };

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if (showSkeleton) {
    return (
      <SkeletonCardFrame className="rounded-2xl border border-border/50 p-6 shadow-card">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-24 w-full" />
      </SkeletonCardFrame>
    );
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Berechtigung für API-Schlüssel.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/50 bg-muted/15 p-5 shadow-card">
        <p className="text-sm text-muted-foreground">
          Read-only JSON-API für Headless-Einbindungen. Schlüssel gelten nur für{" "}
          <strong className="text-foreground">veröffentlichte</strong> Restaurants.
          Rate-Limit: {RESTAURANT_API_RATE_LIMIT_PER_MINUTE} Anfragen pro Minute pro
          Schlüssel.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Basis-URL: <code className="text-foreground">{apiBase}</code> ·{" "}
          <Link href="/docs/api" className="text-accent underline-offset-2 hover:underline">
            Dokumentation
          </Link>
        </p>
      </section>

      <Button
        type="button"
        size="lg"
        className={modulePrimaryAddButtonFullWidthClassName}
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="size-4" />
        Neuer API-Schlüssel
      </Button>

      {keys.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          Noch keine API-Schlüssel angelegt.
        </p>
      ) : (
        <ul className="space-y-3">
          {keys.map((key) => (
            <li
              key={key.id}
              className="rounded-2xl border border-border/50 bg-card p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                    <p className="font-semibold">{key.name}</p>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {key.key_prefix}…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Module:{" "}
                    {key.enabled_modules
                      .map(
                        (id) =>
                          RESTAURANT_API_MODULES.find((m) => m.id === id)?.label ??
                          id,
                      )
                      .join(", ")}
                  </p>
                  {key.allowed_origins.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Domains: {key.allowed_origins.join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Domains: keine Beschränkung
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Erstellt {formatWhen(key.created_at)}
                    {key.last_used_at
                      ? ` · Zuletzt genutzt ${formatWhen(key.last_used_at)}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-destructive hover:text-destructive"
                  onClick={() => void revokeKey(key.id)}
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Widerrufen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>API-Schlüssel erstellen</DialogTitle>
            <DialogDescription>
              Der Secret-Key wird nur einmal angezeigt. Speichere ihn sicher — später
              ist nur noch der Prefix sichtbar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Website Production"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Module</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {RESTAURANT_API_MODULES.map((mod) => (
                  <label
                    key={mod.id}
                    className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedModules.includes(mod.id)}
                      onCheckedChange={(checked) =>
                        toggleModule(mod.id, checked === true)
                      }
                    />
                    {mod.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key-domains">
                Erlaubte Domains (optional)
              </Label>
              <Textarea
                id="api-key-domains"
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                placeholder={"mein-restaurant.de\nwww.mein-restaurant.de"}
                className="min-h-24 rounded-xl font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Leer lassen für Server-zu-Server ohne Origin-Prüfung. Mit Einträgen
                gilt die Allowlist für Browser-Anfragen (Origin).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setCreateOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={cn("rounded-xl", brandActionButtonRoundedClassName)}
              disabled={creating || !name.trim() || selectedModules.length === 0}
              onClick={() => void createKey()}
            >
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Secret-Key — nur jetzt sichtbar</DialogTitle>
            <DialogDescription>
              Kopiere den Schlüssel jetzt. Er kann später nicht erneut angezeigt werden.
            </DialogDescription>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-xl border border-border/50 bg-muted/20 p-3 text-xs break-all">
            {createdSecret}
          </pre>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void copySecret()}>
              Kopieren
            </Button>
            <Button
              type="button"
              className={cn("rounded-xl", brandActionButtonRoundedClassName)}
              onClick={() => {
                setSecretDialogOpen(false);
                setCreatedSecret(null);
              }}
            >
              Gespeichert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
