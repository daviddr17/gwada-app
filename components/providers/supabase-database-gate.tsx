"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import {
  checkWorkspaceDatabaseReachable,
  invalidateWorkspaceRestaurantCache,
} from "@/lib/supabase/workspace-persistence";

type GateState = "ready" | "checking" | "error";

export function SupabaseDatabaseGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<GateState>(() =>
    isSupabaseOnlyMode() ? "checking" : "ready",
  );
  const [message, setMessage] = useState("");

  const runCheck = useCallback(async () => {
    if (!isSupabaseOnlyMode()) {
      setState("ready");
      return;
    }
    setState("checking");
    invalidateWorkspaceRestaurantCache();
    const result = await checkWorkspaceDatabaseReachable();
    if (result.ok) {
      setState("ready");
      setMessage("");
    } else {
      setMessage(result.message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseOnlyMode()) return;
    void runCheck();
  }, [runCheck]);

  if (!isSupabaseOnlyMode()) {
    return <>{children}</>;
  }

  if (state === "checking") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verbinde mit der Datenbank…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader>
            <CardTitle>Datenbank nicht erreichbar</CardTitle>
            <CardDescription className="text-pretty">{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Prüfe, ob Supabase läuft (<code className="rounded bg-muted px-1">supabase status</code>
              ), die Ports stimmen und Migrationen angewendet sind (
              <code className="rounded bg-muted px-1">npm run db:reset</code>).
            </p>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="default" onClick={() => void runCheck()}>
              Erneut versuchen
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
