"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { PasswordStrengthBar } from "@/components/auth/password-strength-bar";
import {
  PASSWORD_POLICY_ERROR_MESSAGE,
  passwordMeetsPolicy,
} from "@/lib/auth/password-policy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function NewPasswordForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sb = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!cancelled) {
          setHasSession(Boolean(user));
        }
      } catch {
        if (!cancelled) setHasSession(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (!passwordMeetsPolicy(password)) {
      toast.error(PASSWORD_POLICY_ERROR_MESSAGE);
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }

    setBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.auth.updateUser({ password });
      if (error) {
        toast.error("Passwort konnte nicht gespeichert werden.", {
          description: error.message,
        });
        return;
      }
      toast.success("Dein Passwort wurde aktualisiert.");
      router.replace("/");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error("Passwort konnte nicht gespeichert werden.", {
        description: msg,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Neues Passwort
          </CardTitle>
          <CardDescription>
            {checking
              ? "Sitzung wird geprüft…"
              : hasSession
                ? "Wähle ein sicheres neues Passwort für dein Konto."
                : "Der Link ist ungültig oder abgelaufen. Fordere einen neuen Link an."}
          </CardDescription>
        </CardHeader>
        {hasSession && !checking ? (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pw">Neues Passwort</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
              />
              <PasswordStrengthBar password={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw-2">Passwort wiederholen</Label>
              <Input
                id="new-pw-2"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) void handleSubmit();
                }}
                className="h-11 rounded-xl"
              />
              <PasswordStrengthBar
                password={passwordConfirm}
                showRequirements={false}
              />
            </div>
          </CardContent>
        ) : null}
        <CardFooter className="flex flex-col gap-3">
          {hasSession && !checking ? (
            <Button
              type="button"
              className="h-11 w-full"
              disabled={busy}
              onClick={() => void handleSubmit()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Speichern…
                </>
              ) : (
                "Passwort speichern"
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={!checking && !hasSession ? "default" : "ghost"}
            className="h-11 w-full"
            onClick={() => router.push("/login")}
          >
            Zur Anmeldung
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
