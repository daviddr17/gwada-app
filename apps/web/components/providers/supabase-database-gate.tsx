"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GWADA_DB_UNAVAILABLE_MESSAGE,
  isSupabaseOnlyMode,
} from "@/lib/constants/database-mode";

type GateState = "ready" | "checking" | "error";

export type WorkspaceDatabaseGateContextValue = {
  status: GateState;
  /** Technische Meldung der letzten Erreichbarkeitsprüfung (bei Fehler). */
  message: string;
  /**
   * Prüft die DB und aktualisiert `status` / `message`.
   * Rückgabe enthält dieselbe Meldung wie der Hook (auch direkt nach dem Aufruf nutzbar).
   */
  ensureReachable: () => Promise<{ ok: boolean; message: string }>;
};

const WorkspaceDatabaseGateContext =
  createContext<WorkspaceDatabaseGateContextValue | null>(null);

export function useWorkspaceDatabaseGate(): WorkspaceDatabaseGateContextValue {
  const ctx = useContext(WorkspaceDatabaseGateContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceDatabaseGate muss innerhalb von SupabaseDatabaseGate verwendet werden.",
    );
  }
  return ctx;
}

export function SupabaseDatabaseGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  /** Marketing + Login: keine Mount-DB-Probe (schneller; Login prüft bei Klick auf „Weiter“). */
  const skipDbProbe =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/embed/") ||
    pathname.startsWith("/einladung/");

  const supabaseOnly = isSupabaseOnlyMode();
  const [state, setState] = useState<GateState>(() =>
    supabaseOnly && !skipDbProbe ? "checking" : "ready",
  );
  const [message, setMessage] = useState("");

  const ensureReachable = useCallback(async () => {
    if (!supabaseOnly) {
      setState("ready");
      setMessage("");
      return { ok: true as const, message: "" };
    }
    setState("checking");
    try {
      const { checkWorkspaceDatabaseReachable } = await import(
        "@/lib/supabase/check-workspace-database-reachable"
      );
      const result = await checkWorkspaceDatabaseReachable();
      if (result.ok) {
        setState("ready");
        setMessage("");
      } else {
        setMessage(result.message);
        setState("error");
      }
      return result;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      const msg = `${GWADA_DB_UNAVAILABLE_MESSAGE} (${detail})`;
      setMessage(msg);
      setState("error");
      return { ok: false as const, message: msg };
    }
  }, [supabaseOnly]);

  useEffect(() => {
    if (!supabaseOnly) return;
    if (skipDbProbe) return;
    // ensureReachable setzt State asynchron nach Netzwerkantwort; Mount-Probe ist bewusst.
    void Promise.resolve().then(() => ensureReachable());
  }, [supabaseOnly, skipDbProbe, ensureReachable]);

  const statusForUi = useMemo<GateState>(
    () => (!supabaseOnly || skipDbProbe ? "ready" : state),
    [supabaseOnly, skipDbProbe, state],
  );
  const messageForUi = skipDbProbe ? "" : message;

  const value = useMemo<WorkspaceDatabaseGateContextValue>(
    () => ({
      status: statusForUi,
      message: messageForUi,
      ensureReachable,
    }),
    [statusForUi, messageForUi, ensureReachable],
  );

  return (
    <WorkspaceDatabaseGateContext.Provider value={value}>
      {children}
    </WorkspaceDatabaseGateContext.Provider>
  );
}
