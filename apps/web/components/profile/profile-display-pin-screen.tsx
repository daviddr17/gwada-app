"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import {
  fetchProfileDisplayPinStatus,
  saveProfileDisplayPin,
} from "@/lib/staff/profile-display-pin-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { cn } from "@/lib/utils";

export function ProfileDisplayPinScreen() {
  const {
    restaurantId,
    workspaceReady,
    staff,
    loading: staffLoading,
    showSkeleton: staffSkeleton,
  } = useMyRestaurantStaff();

  const [statusLoading, setStatusLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [setAt, setSetAt] = useState<string | null>(null);
  const [selfServiceEnabled, setSelfServiceEnabled] = useState(false);
  const [canUsePassword, setCanUsePassword] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [removePin, setRemovePin] = useState(false);
  const [saving, setSaving] = useState(false);

  const showSkeleton = useDeferredSkeleton(
    staffLoading || statusLoading || !authResolved,
  );

  const reloadStatus = useCallback(async () => {
    if (!restaurantId || !staff) {
      setHasPin(false);
      setSetAt(null);
      setSelfServiceEnabled(false);
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    const { data, error } = await fetchProfileDisplayPinStatus({ restaurantId });
    setStatusLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (data) {
      setHasPin(data.hasPin);
      setSetAt(data.setAt);
      setSelfServiceEnabled(data.selfServiceEnabled);
    }
  }, [restaurantId, staff]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!workspacePersistenceConfigured()) {
        if (!cancelled) {
          setCanUsePassword(false);
          setAuthResolved(true);
        }
        return;
      }
      const sb = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      const identities = user?.identities ?? [];
      const hasEmailIdentity = identities.some((i) => i.provider === "email");
      if (!cancelled) {
        setCanUsePassword(Boolean(user?.email && hasEmailIdentity));
        setAuthResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!staffLoading && staff) {
      void reloadStatus();
    } else if (!staffLoading && !staff) {
      setStatusLoading(false);
    }
  }, [staffLoading, staff, reloadStatus]);

  const dirty =
    canUsePassword &&
    selfServiceEnabled &&
    Boolean(staff) &&
    (removePin ||
      currentPassword.length > 0 ||
      newPin.length > 0 ||
      confirmPin.length > 0);

  const handleSave = async () => {
    if (!restaurantId) return;
    if (!currentPassword) {
      toast.error("Bitte dein Gwada-Passwort eingeben.");
      return;
    }
    if (!removePin) {
      if (!/^[0-9]{4}$/.test(newPin)) {
        toast.error("Die PIN muss genau vier Ziffern haben.");
        return;
      }
      if (newPin !== confirmPin) {
        toast.error("Die PIN-Bestätigung stimmt nicht überein.");
        return;
      }
    }

    setSaving(true);
    const { ok, error } = await saveProfileDisplayPin({
      restaurantId,
      pin: removePin ? null : newPin,
      pinConfirm: removePin ? undefined : confirmPin,
      currentPassword,
    });
    setSaving(false);

    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }

    toast.success(
      removePin ? "Display-PIN wurde entfernt." : "Display-PIN wurde gespeichert.",
    );
    setNewPin("");
    setConfirmPin("");
    setCurrentPassword("");
    setRemovePin(false);
    await reloadStatus();
  };

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if ((staffLoading || statusLoading || !authResolved) && showSkeleton) {
    return <div className="min-h-[20rem] animate-pulse rounded-xl bg-muted/30" />;
  }

  if (!staff) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Display-PIN</CardTitle>
          <CardDescription>
            Dein Benutzerkonto ist mit keinem Mitarbeiterdatensatz in diesem
            Restaurant verknüpft.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!selfServiceEnabled) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Display-PIN</CardTitle>
          <CardDescription>
            Self-Service ist für dieses Restaurant deaktiviert. Bitte wende dich
            an deine Führungskraft, wenn du deine Display-PIN ändern musst.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Display-PIN</CardTitle>
          <CardDescription>
            4-stellige PIN für Restaurant-Displays. Pro Restaurant eindeutig —
            jede PIN darf nur einmal vergeben werden. Aus Sicherheitsgründen
            kann die aktuelle PIN nicht angezeigt werden; du kannst sie hier
            ersetzen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {hasPin ? (
              <>
                Aktuell ist eine PIN gesetzt
                {setAt
                  ? ` (seit ${new Date(setAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })})`
                  : ""}
                .
              </>
            ) : (
              "Noch keine PIN hinterlegt."
            )}
          </p>

          {!canUsePassword ? (
            <p className="text-sm text-muted-foreground">
              Für dein Konto ist keine E-Mail-Passwort-Anmeldung hinterlegt
              (z.&nbsp;B. nur OAuth). In dem Fall kann die Display-PIN nur von
              der Führungskraft unter Mitarbeiter geändert werden.
            </p>
          ) : (
            <>
              {!removePin ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="profile-display-pin-new">Neue PIN</Label>
                    <Input
                      id="profile-display-pin-new"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      value={newPin}
                      placeholder={hasPin ? "••••" : "1234"}
                      onChange={(e) =>
                        setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-display-pin-confirm">
                      PIN bestätigen
                    </Label>
                    <Input
                      id="profile-display-pin-confirm"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      value={confirmPin}
                      onChange={(e) =>
                        setConfirmPin(
                          e.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                      className="h-11 rounded-xl"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Die PIN wird beim Speichern entfernt.
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="profile-display-pin-password">
                  Gwada-Passwort
                </Label>
                <Input
                  id="profile-display-pin-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-11 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Zur Sicherheit musst du dein Anmelde-Passwort bestätigen.
                </p>
              </div>

              {hasPin && !removePin ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:text-destructive"
                  disabled={saving}
                  onClick={() => {
                    setRemovePin(true);
                    setNewPin("");
                    setConfirmPin("");
                  }}
                >
                  PIN entfernen
                </Button>
              ) : removePin ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  disabled={saving}
                  onClick={() => setRemovePin(false)}
                >
                  Entfernen abbrechen
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {canUsePassword ? (
        <SettingsStickySaveBar show={dirty}>
          <Button
            type="button"
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
            disabled={saving || !dirty}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Wird gespeichert…
              </>
            ) : removePin ? (
              "PIN entfernen"
            ) : hasPin ? (
              "PIN ersetzen"
            ) : (
              "PIN speichern"
            )}
          </Button>
        </SettingsStickySaveBar>
      ) : null}
    </div>
  );
}
