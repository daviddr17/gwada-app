"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Apple, ArrowLeft, Loader2 } from "lucide-react";
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
import { useWorkspaceDatabaseGate } from "@/components/providers/supabase-database-gate";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_SUPABASE_SIGNIN_TIMEOUT_MS,
  raceWithTimeout,
} from "@/lib/supabase/race-timeout";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import {
  startOAuthFlow,
  type GwadaOAuthProvider,
} from "@/lib/supabase/oauth";

type Screen = "login" | "register";

const backNavLinkClass =
  "inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

function isLikelyNetworkAuthFailure(message: string): boolean {
  return /load failed|failed to fetch|networkerror|network request failed|fetch|keine antwort nach/i.test(
    message,
  );
}

/** Keine Entwickler-Hinweise (Timeouts, Slugs, npm) in Toast-Beschreibungen. */
function isTechnicalLoginToastDetail(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return (
    /Restaurant-|Workspace-|App-State|Supabase-Session|Erreichbarkeit|keine Antwort nach|\d+\s*s\b|Zeitüberschreitung|\bnpm\b|`npm|db:start|NEXT_PUBLIC|127\.0\.0\.1|localhost:\d+/i.test(
      t,
    ) ||     /^Anmeldung \(Passwort\):/i.test(t) ||
    /Missing NEXT_PUBLIC_SUPABASE/i.test(t)
  );
}

export function LoginForm() {
  const { status: dbStatus, ensureReachable } = useWorkspaceDatabaseGate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const [screen, setScreen] = useState<Screen>("login");
  const [email, setEmail] = useState("dreyer@techlion.de");
  const [password, setPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const loginToastError = (headline: string, detail?: string) => {
    const d = detail?.trim();
    if (d && !isTechnicalLoginToastDetail(d)) {
      toast.error(headline, { description: d });
      return;
    }
    toast.error(headline);
  };

  /** Bereits angemeldet: weiterleiten (Server-`getUser` auf /login ist absichtlich ausgelassen für schnelleren Load). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sb = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (cancelled || !session?.user) return;
        const next = safeInternalPath(nextParam);
        router.replace(next);
        router.refresh();
      } catch {
        /* Session optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, nextParam]);

  useEffect(() => {
    const err = searchParams.get("error");
    if (!err?.trim()) return;
    loginToastError("Anmeldung fehlgeschlagen.", err);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const qs = params.toString();
    router.replace(qs ? `/login?${qs}` : "/login");
  }, [searchParams, router]);

  const handleOAuth = async (provider: GwadaOAuthProvider) => {
    setBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await startOAuthFlow(sb, provider, {
        next: safeInternalPath(nextParam),
      });
      if (error) {
        loginToastError(
          provider === "google"
            ? "Anmeldung mit Google fehlgeschlagen."
            : "Anmeldung mit Apple fehlgeschlagen.",
          error.message,
        );
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      loginToastError("Anmeldung fehlgeschlagen.", raw);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    setBusy(true);
    try {
      if (isSupabaseOnlyMode()) {
        let reach: { ok: boolean; message: string };
        try {
          reach = await ensureReachable();
        } catch {
          loginToastError("Die Datenbank konnte nicht geprüft werden.");
          return;
        }
        if (!reach.ok) {
          loginToastError(
            "Aktuell gibt es Probleme mit der Datenbank. Eine Anmeldung ist zurzeit nicht möglich.",
          );
          return;
        }
      }
      const sb = createSupabaseBrowserClient();
      let signResult: Awaited<
        ReturnType<typeof sb.auth.signInWithPassword>
      >;
      try {
        signResult = await raceWithTimeout(
          sb.auth.signInWithPassword({
            email: email.trim(),
            password,
          }),
          GWADA_SUPABASE_SIGNIN_TIMEOUT_MS,
          "Anmeldung (Passwort)",
        );
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        if (isLikelyNetworkAuthFailure(raw)) {
          loginToastError(
            "Keine Verbindung zum Anmeldedienst. Bitte Netzwerk prüfen und es später erneut versuchen.",
            raw,
          );
        } else {
          loginToastError("Anmeldung fehlgeschlagen.", raw);
        }
        return;
      }
      const { error } = signResult;
      if (error) {
        const em = error.message?.trim() || "";
        if (isLikelyNetworkAuthFailure(em)) {
          loginToastError(
            "Keine Verbindung zum Anmeldedienst. Bitte Netzwerk prüfen und es später erneut versuchen.",
            em,
          );
        } else {
          loginToastError(em || "Anmeldung fehlgeschlagen.");
        }
        return;
      }
      const next = safeInternalPath(searchParams.get("next"));
      router.replace(next);
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      loginToastError("Anmeldung fehlgeschlagen.", raw);
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = () => {
    if (!regEmail.trim()) {
      toast.error("Bitte eine E-Mail-Adresse eingeben.");
      return;
    }
    if (!regPassword) {
      toast.error("Bitte ein Passwort eingeben.");
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }
    toast.info("Registrierung folgt in einem späteren Schritt.");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col gap-3">
        {screen === "login" ? (
          <Link href="/" className={backNavLinkClass}>
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Zurück zur Startseite
          </Link>
        ) : (
          <button
            type="button"
            className={backNavLinkClass}
            aria-label="Zurück zur Anmeldung"
            onClick={() => setScreen("login")}
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Zurück zur Anmeldung
          </button>
        )}
        <Card className="w-full border-border/50 shadow-card">
          {screen === "login" ? (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Anmelden
                </CardTitle>
                <CardDescription>
                  Melde dich an, um deine Restaurants zu verwalten.
                </CardDescription>
                {isSupabaseOnlyMode() && dbStatus === "checking" ? (
                  <p className="text-sm text-muted-foreground">
                    Datenbankverbindung wird geprüft…
                  </p>
                ) : null}
                {isSupabaseOnlyMode() && dbStatus === "error" ? (
                  <p className="text-pretty text-sm text-destructive">
                    Die Datenbank ist derzeit nicht erreichbar.
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">E-Mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Passwort</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleLogin();
                  }}
                  className="h-11 rounded-xl"
                />
              </div>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={busy}
                onClick={() => void handleLogin()}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Anmeldung…
                  </>
                ) : (
                  "Weiter"
                )}
              </Button>

              <div className="relative py-1">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  oder
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 rounded-xl border-border/80 bg-background font-normal"
                  disabled={busy}
                  onClick={() => void handleOAuth("google")}
                >
                  <GoogleGlyph />
                  Mit Google anmelden
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 rounded-xl border-border/80 bg-background font-normal"
                  disabled={busy}
                  onClick={() => void handleOAuth("apple")}
                >
                  <Apple className="size-5 shrink-0" aria-hidden />
                  Mit Apple anmelden
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-border/40 bg-muted/20 px-6 py-4 sm:px-8">
              <p className="text-center text-sm text-muted-foreground">
                Noch kein Konto?
              </p>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-xl"
                onClick={() => {
                  setScreen("register");
                  if (!regEmail.trim()) setRegEmail(email.trim());
                }}
              >
                Registrieren
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Registrieren
              </CardTitle>
              <CardDescription>
                Lege ein Konto an. OAuth und Bestätigung folgen später — hier
                nur die Eingaben.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-email">E-Mail</Label>
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Passwort</Label>
                <Input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password-2">Passwort wiederholen</Label>
                <Input
                  id="reg-password-2"
                  type="password"
                  autoComplete="new-password"
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRegisterSubmit();
                  }}
                  className="h-11 rounded-xl"
                />
              </div>
              <Button
                type="button"
                className="h-11 w-full"
                onClick={handleRegisterSubmit}
              >
                Konto anlegen
              </Button>

              <div className="relative py-1">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  oder
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 rounded-xl border-border/80 bg-background font-normal"
                  disabled={busy}
                  onClick={() => void handleOAuth("google")}
                >
                  <GoogleGlyph />
                  Mit Google registrieren
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 rounded-xl border-border/80 bg-background font-normal"
                  disabled={busy}
                  onClick={() => void handleOAuth("apple")}
                >
                  <Apple className="size-5 shrink-0" aria-hidden />
                  Mit Apple registrieren
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
      </div>
    </div>
  );
}
