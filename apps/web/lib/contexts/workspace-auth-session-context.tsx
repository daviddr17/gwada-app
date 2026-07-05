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

    return () => {
      cancelled = true;
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
