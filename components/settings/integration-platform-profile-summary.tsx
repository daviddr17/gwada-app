"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { platformProfileErrorMessage } from "@/lib/integrations/platform-profile-user-messages";
import {
  EMPTY_INTEGRATION_PLATFORM_PROFILE,
  type IntegrationPlatformProfile,
  type IntegrationPlatformProfileProvider,
} from "@/lib/integrations/platform-profile-types";
import { cn } from "@/lib/utils";

const PROFILE_API_SEGMENT: Record<IntegrationPlatformProfileProvider, string> = {
  google_business: "google-business",
  facebook: "facebook",
  instagram: "instagram",
};

const PLATFORM_LABEL: Record<IntegrationPlatformProfileProvider, string> = {
  google_business: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
};

function profilesEqual(
  a: IntegrationPlatformProfile,
  b: IntegrationPlatformProfile,
) {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.phone === b.phone &&
    a.website === b.website &&
    a.address === b.address
  );
}

export function IntegrationPlatformProfileSummary({
  provider,
  restaurantId,
  platformTitle,
  onSaved,
}: {
  provider: IntegrationPlatformProfileProvider;
  restaurantId: string;
  platformTitle: string;
  onSaved?: () => void;
}) {
  const [baseline, setBaseline] = useState<IntegrationPlatformProfile>(
    EMPTY_INTEGRATION_PLATFORM_PROFILE,
  );
  const [draft, setDraft] = useState<IntegrationPlatformProfile>(
    EMPTY_INTEGRATION_PLATFORM_PROFILE,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const dirty = useMemo(
    () => !profilesEqual(draft, baseline),
    [draft, baseline],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const segment = PROFILE_API_SEGMENT[provider];
      const res = await fetch(
        `/api/integrations/${segment}/profile?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        profile?: IntegrationPlatformProfile;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.profile) {
        setLoadError(
          platformProfileErrorMessage(data.error ?? "profile_load_failed"),
        );
        setBaseline(EMPTY_INTEGRATION_PLATFORM_PROFILE);
        setDraft(EMPTY_INTEGRATION_PLATFORM_PROFILE);
        return;
      }
      setBaseline(data.profile);
      setDraft(data.profile);
    } catch {
      setLoadError("Profil konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [provider, restaurantId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateField = <K extends keyof IntegrationPlatformProfile>(
    key: K,
    value: IntegrationPlatformProfile[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const segment = PROFILE_API_SEGMENT[provider];
      const res = await fetch(`/api/integrations/${segment}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, profile: draft }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(
          `${PLATFORM_LABEL[provider]}: ${platformProfileErrorMessage(data.error ?? "profile_save_failed")}`,
        );
        return;
      }
      setBaseline(draft);
      toast.success(
        `${PLATFORM_LABEL[provider]}: Profil auf der Plattform aktualisiert.`,
      );
      onSaved?.();
    } catch {
      toast.error(`${PLATFORM_LABEL[provider]}: Speichern fehlgeschlagen.`);
    } finally {
      setSaving(false);
    }
  };

  const isInstagram = provider === "instagram";

  if (showSkeleton) {
    return (
      <div className="space-y-3 pt-2">
        <Separator />
        <SkeletonCardFrame className="border-border/50 shadow-none">
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </SkeletonCardFrame>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3 pt-2">
        <Separator />
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => void loadProfile()}
        >
          Profil erneut laden
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <Separator />
      <div className="space-y-1">
        <h4 className="text-sm font-semibold tracking-tight text-foreground">
          Profil auf {platformTitle}
        </h4>
        <p className="text-xs text-muted-foreground">
          Stand vom verbundenen {PLATFORM_LABEL[provider]}-Profil — Änderungen
          werden direkt über die API übernommen.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4 shadow-card">
        {!isInstagram ? (
          <div className="space-y-2">
            <Label htmlFor={`${provider}-profile-name`}>Name</Label>
            <Input
              id={`${provider}-profile-name`}
              value={draft.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="h-10 rounded-lg"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`${provider}-profile-name`}>Profilname</Label>
            <Input
              id={`${provider}-profile-name`}
              value={draft.name}
              readOnly
              className="h-10 rounded-lg bg-muted/40"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`${provider}-profile-description`}>
            {isInstagram ? "Bio" : "Beschreibung"}
          </Label>
          <Textarea
            id={`${provider}-profile-description`}
            value={draft.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={3}
            className="min-h-[5rem] resize-y rounded-lg"
          />
        </div>

        {!isInstagram ? (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${provider}-profile-phone`}>Telefon</Label>
              <Input
                id={`${provider}-profile-phone`}
                value={draft.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${provider}-profile-website`}>Website</Label>
              <Input
                id={`${provider}-profile-website`}
                value={draft.website}
                onChange={(e) => updateField("website", e.target.value)}
                className="h-10 rounded-lg"
                inputMode="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${provider}-profile-address`}>Adresse</Label>
              <Input
                id={`${provider}-profile-address`}
                value={draft.address}
                onChange={(e) => updateField("address", e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`${provider}-profile-website`}>Website</Label>
            <Input
              id={`${provider}-profile-website`}
              value={draft.website}
              onChange={(e) => updateField("website", e.target.value)}
              className="h-10 rounded-lg"
              inputMode="url"
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={saving}
            onClick={() => setDraft(baseline)}
          >
            Zurücksetzen
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || saving}
            className={cn("rounded-xl", settingsAccentSaveButtonClassName)}
            onClick={() => void saveProfile()}
          >
            {saving ? "Speichern…" : "Profil speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
