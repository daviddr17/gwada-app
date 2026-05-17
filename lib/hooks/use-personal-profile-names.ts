"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY } from "@/lib/constants/user-identity";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import type { OrderProtocolActor } from "@/lib/types/purchase-order";
import { formatOrderProtocolUserName } from "@/lib/types/purchase-order";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  loadWorkspaceJson,
  persistWorkspaceState,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

type PersistedV2 = { version: 2; firstName: string; lastName: string };
type PersistedV1 = { version: 1; displayName: string };

function readNamesFromPayload(parsed: unknown): { firstName: string; lastName: string } {
  if (typeof parsed !== "object" || parsed === null) {
    return { firstName: "", lastName: "" };
  }
  const v = (parsed as { version?: number }).version;
  if (v === 2 && "firstName" in parsed && "lastName" in parsed) {
    const p = parsed as PersistedV2;
    return {
      firstName: typeof p.firstName === "string" ? p.firstName : "",
      lastName: typeof p.lastName === "string" ? p.lastName : "",
    };
  }
  if (v === 1 && "displayName" in parsed) {
    const p = parsed as PersistedV1;
    const t = typeof p.displayName === "string" ? p.displayName.trim() : "";
    if (!t) return { firstName: "", lastName: "" };
    const sp = t.indexOf(" ");
    if (sp === -1) return { firstName: "", lastName: t };
    return {
      firstName: t.slice(0, sp).trim(),
      lastName: t.slice(sp + 1).trim(),
    };
  }
  return { firstName: "", lastName: "" };
}

function load(): { firstName: string; lastName: string } {
  if (typeof window === "undefined") return { firstName: "", lastName: "" };
  try {
    const raw = localStorage.getItem(USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY);
    if (!raw) return { firstName: "", lastName: "" };
    const parsed: unknown = JSON.parse(raw);
    return readNamesFromPayload(parsed);
  } catch {
    return { firstName: "", lastName: "" };
  }
}

/**
 * Vor- und Nachname aus dem persönlichen Profil (Profilseite), lokal gespeichert.
 * Wird für Bestellprotokolle und Bestellaktionen verwendet.
 */
export function usePersonalProfileNames() {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [authTick, setAuthTick] = useState(0);

  useEffect(() => {
    if (!workspacePersistenceConfigured()) return;
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setAuthTick((t) => t + 1);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let names: { firstName: string; lastName: string } = {
        firstName: "",
        lastName: "",
      };

      if (workspacePersistenceConfigured()) {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("given_name, family_name")
            .eq("id", user.id)
            .maybeSingle();
          if (!cancelled && prof) {
            names = {
              firstName:
                typeof prof.given_name === "string" ? prof.given_name : "",
              lastName:
                typeof prof.family_name === "string" ? prof.family_name : "",
            };
          }
        }
      }

      if (!names.firstName && !names.lastName) {
        const remote = await loadWorkspaceJson(
          USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
        );
        if (supabaseOnly) {
          names =
            remote && typeof remote === "object" && !Array.isArray(remote)
              ? readNamesFromPayload(remote)
              : { firstName: "", lastName: "" };
        } else if (
          remote &&
          typeof remote === "object" &&
          !Array.isArray(remote)
        ) {
          names = readNamesFromPayload(remote);
          try {
            localStorage.setItem(
              USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
              JSON.stringify(remote),
            );
          } catch {
            /* ignore */
          }
        } else {
          names = load();
        }
      }

      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        setFirstName(names.firstName);
        setLastName(names.lastName);
        setIsHydrated(true);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly, authTick]);

  const actor: OrderProtocolActor = useMemo(
    () => ({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    }),
    [firstName, lastName],
  );

  const resolvedFullName = formatOrderProtocolUserName(actor) || "Nutzer";

  const save = useCallback(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    const prev = { firstName, lastName };
    setFirstName(f);
    setLastName(l);

    void (async () => {
      if (workspacePersistenceConfigured()) {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from("profiles")
            .update({ given_name: f, family_name: l })
            .eq("id", user.id);
          if (error) {
            setFirstName(prev.firstName);
            setLastName(prev.lastName);
            failSave();
            return;
          }
          toast.success("Vor- und Nachname gespeichert");
          return;
        }
      }

      const payload: PersistedV2 = {
        version: 2,
        firstName: f,
        lastName: l,
      };
      const ok = await persistWorkspaceState(
        USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
        payload,
      );
      if (!ok) {
        setFirstName(prev.firstName);
        setLastName(prev.lastName);
        failSave();
      } else {
        toast.success("Vor- und Nachname gespeichert");
      }
    })();
    return true;
  }, [firstName, lastName, failSave]);

  return {
    firstName,
    lastName,
    setFirstName,
    setLastName,
    save,
    actor,
    resolvedFullName,
    isHydrated,
  };
}
