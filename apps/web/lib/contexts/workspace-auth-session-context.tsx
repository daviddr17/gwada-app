"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type WorkspaceAuthSessionValue = {
  user: User | null;
  session: Session | null;
  ready: boolean;
};

const WorkspaceAuthSessionContext =
  createContext<WorkspaceAuthSessionValue | null>(null);

/** Refresh wenn Access-Token in weniger als 5 Min abläuft. */
const REFRESH_WITHIN_MS = 5 * 60_000;
/** Sichtbarer Dauerbetrieb: alle 20 Min prüfen (Supabase autoRefresh reicht meist). */
const PROACTIVE_CHECK_MS = 20 * 60_000;

async function refreshSessionIfNeeded(
  sb: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<void> {
  try {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session) {
      await sb.auth.refreshSession();
      return;
    }
    const expiresAtMs =
      typeof session.expires_at === "number"
        ? session.expires_at * 1000
        : null;
    if (expiresAtMs != null && expiresAtMs - Date.now() <= REFRESH_WITHIN_MS) {
      await sb.auth.refreshSession();
    }
  } catch {
    /* Netz / Offline — nächster Visibility-/Intervall-Tick */
  }
}

/** Eine Session-Instanz pro App-Zone — kein wiederholtes auth.getUser() pro Modul. */
export function WorkspaceAuthSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const sbRef = useRef(createSupabaseBrowserClient());

  useEffect(() => {
    const sb = sbRef.current;
    let cancelled = false;
    let proactiveId: number | null = null;

    void sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setReady(true);
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });

    const stopProactive = () => {
      if (proactiveId == null) return;
      window.clearInterval(proactiveId);
      proactiveId = null;
    };

    const startProactive = () => {
      if (proactiveId != null) return;
      proactiveId = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void refreshSessionIfNeeded(sb);
      }, PROACTIVE_CHECK_MS);
    };

    if (document.visibilityState === "visible") {
      startProactive();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshSessionIfNeeded(sb);
        startProactive();
        return;
      }
      stopProactive();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stopProactive();
      document.removeEventListener("visibilitychange", onVisibility);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<WorkspaceAuthSessionValue>(
    () => ({
      user: session?.user ?? null,
      session,
      ready,
    }),
    [session, ready],
  );

  return (
    <WorkspaceAuthSessionContext.Provider value={value}>
      {children}
    </WorkspaceAuthSessionContext.Provider>
  );
}

export function useWorkspaceAuthSession(): WorkspaceAuthSessionValue {
  const ctx = useContext(WorkspaceAuthSessionContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceAuthSession erfordert WorkspaceAuthSessionProvider.",
    );
  }
  return ctx;
}
