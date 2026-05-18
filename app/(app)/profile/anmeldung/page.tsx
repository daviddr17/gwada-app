"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Apple, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { ProfileAnmeldungSkeleton } from "@/components/profile/profile-anmeldung-skeleton";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";
import { cn } from "@/lib/utils";

/** Mindestlänge wie in `supabase/config.toml` (`minimum_password_length`). */
const MIN_PASSWORD_LENGTH = 6;

/** Status-Chip „verbunden“ in Tenant-Akzentfarbe (nicht der umgebende Container). */
const oauthConnectedBadgeClassName = cn(
  "border-transparent bg-accent font-normal text-accent-foreground shadow-none",
);

/** Platzhalter bis echte OAuth-Anbindung (nur UI). */
const DEMO_OAUTH = {
  googleSignedIn: true,
  appleRegistered: true,
} as const;

export default function ProfileAnmeldungPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!workspacePersistenceConfigured()) {
          setCanChangePassword(false);
          return;
        }
        const sb = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (cancelled) return;
        if (!user?.email) {
          setCanChangePassword(false);
          return;
        }
        const hasEmailIdentity =
          user.identities?.some((i) => i.provider === "email") ?? false;
        setCanChangePassword(hasEmailIdentity);
      } finally {
        if (!cancelled) setAuthResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const authLoading = !authResolved;
  const showAuthSkeleton = useDeferredSkeleton(authLoading);

  if (authLoading) {
    if (showAuthSkeleton) {
      return <ProfileAnmeldungSkeleton />;
    }
    return (
      <div
        className="min-h-[24rem] w-full"
        aria-busy="true"
        aria-label="Anmeldedaten werden geladen"
      />
    );
  }

  const oauthSoon = () =>
    toast.info("Konto-Verknüpfung folgt in einem späteren Schritt.");

  const handlePasswordChange = async () => {
    if (!workspacePersistenceConfigured()) {
      toast.error("Supabase ist nicht konfiguriert.");
      return;
    }
    if (!canChangePassword) {
      toast.error(
        "Passwort-Änderung ist nur bei Anmeldung per E-Mail möglich.",
      );
      return;
    }
    if (!currentPassword) {
      toast.error("Bitte das aktuelle Passwort eingeben.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `Neues Passwort mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Das neue Passwort muss sich vom aktuellen unterscheiden.");
      return;
    }

    setPwBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      const email = user?.email;
      if (!email) {
        toast.error("Keine E-Mail-Adresse in der Session.");
        return;
      }

      const { error: signErr } = await sb.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signErr) {
        toast.error("Aktuelles Passwort ist falsch.");
        return;
      }

      const { error: updErr } = await sb.auth.updateUser({
        password: newPassword,
      });
      if (updErr) {
        toast.error(updErr.message);
        return;
      }

      toast.success("Passwort wurde geändert.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">OAuth &amp; Konten</CardTitle>
          <CardDescription>
            Google und Apple verknüpfen oder Status prüfen (Anbindung folgt
            später).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Google
              </span>
              {DEMO_OAUTH.googleSignedIn ? (
                <Badge className={oauthConnectedBadgeClassName}>
                  Mit Google verbunden
                </Badge>
              ) : (
                <Badge variant="secondary">Nicht verbunden</Badge>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 gap-2 rounded-xl border-border/80 bg-background font-normal sm:ms-auto"
              onClick={oauthSoon}
            >
              <GoogleGlyph />
              {DEMO_OAUTH.googleSignedIn
                ? "Google verwalten"
                : "Mit Google verknüpfen"}
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Apple
              </span>
              {DEMO_OAUTH.appleRegistered ? (
                <Badge className={oauthConnectedBadgeClassName}>
                  Mit Apple verbunden
                </Badge>
              ) : (
                <Badge variant="secondary">Nicht verbunden</Badge>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 gap-2 rounded-xl border-border/80 bg-background font-normal sm:ms-auto"
              onClick={oauthSoon}
            >
              <Apple className="size-5 shrink-0" aria-hidden />
              {DEMO_OAUTH.appleRegistered
                ? "Apple verwalten"
                : "Mit Apple verknüpfen"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Badges und Buttons sind Vorschau — echte OAuth-Prüfung und
            Konto-Verknüpfung werden später implementiert.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Passwort ändern</CardTitle>
          <CardDescription>
            Nur bei Anmeldung per E-Mail und Passwort. Es wird zuerst das aktuelle
            Passwort geprüft; die beiden neuen Eingaben müssen übereinstimmen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!workspacePersistenceConfigured() ? (
            <p className="text-sm text-muted-foreground">
              Supabase-Umgebungsvariablen fehlen — Passwort ändern ist hier nicht
              verfügbar.
            </p>
          ) : !canChangePassword ? (
            <p className="text-sm text-muted-foreground">
              Für dein Konto ist keine E-Mail-Passwort-Anmeldung hinterlegt
              (z.&nbsp;B. nur OAuth). In dem Fall gibt es kein Passwort zum
              Ändern.
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="pw-current">Aktuelles Passwort</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={!canChangePassword}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-new">Neues Passwort</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={!canChangePassword}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Mindestens {MIN_PASSWORD_LENGTH} Zeichen.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-confirm">Neues Passwort wiederholen</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canChangePassword && !pwBusy) {
                  void handlePasswordChange();
                }
              }}
              disabled={!canChangePassword}
              className="h-11 rounded-xl"
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 border-t border-border/40 bg-muted/15 px-6 py-4 sm:flex-row sm:items-center sm:px-8">
          <Button
            type="button"
            className={cn(
              "h-11 w-full sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
            disabled={!canChangePassword || pwBusy}
            onClick={() => void handlePasswordChange()}
          >
            {pwBusy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Wird geändert…
              </>
            ) : (
              "Passwort aktualisieren"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
