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

type PersistedV3 = {
  version: 3;
  firstName: string;
  lastName: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};
type PersistedV2 = { version: 2; firstName: string; lastName: string };
type PersistedV1 = { version: 1; displayName: string };

export type PersonalProfileDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

function namesFromDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const t = displayName.trim();
  if (!t) return { firstName: "", lastName: "" };
  const sp = t.indexOf(" ");
  if (sp === -1) return { firstName: "", lastName: t };
  return {
    firstName: t.slice(0, sp).trim(),
    lastName: t.slice(sp + 1).trim(),
  };
}

function readPersistedProfile(parsed: unknown): PersonalProfileDraft {
  if (typeof parsed !== "object" || parsed === null) {
    return emptyDraft();
  }
  const v = (parsed as { version?: number }).version;
  if (v === 3) {
    const p = parsed as PersistedV3;
    return {
      firstName: typeof p.firstName === "string" ? p.firstName : "",
      lastName: typeof p.lastName === "string" ? p.lastName : "",
      birthDate: typeof p.birthDate === "string" ? p.birthDate : "",
      street: typeof p.street === "string" ? p.street : "",
      postalCode: typeof p.postalCode === "string" ? p.postalCode : "",
      city: typeof p.city === "string" ? p.city : "",
      country: typeof p.country === "string" ? p.country : "DE",
    };
  }
  if (v === 2 && "firstName" in parsed && "lastName" in parsed) {
    const p = parsed as PersistedV2;
    return {
      firstName: typeof p.firstName === "string" ? p.firstName : "",
      lastName: typeof p.lastName === "string" ? p.lastName : "",
      birthDate: "",
      street: "",
      postalCode: "",
      city: "",
      country: "DE",
    };
  }
  if (v === 1 && "displayName" in parsed) {
    const p = parsed as PersistedV1;
    const n = namesFromDisplayName(
      typeof p.displayName === "string" ? p.displayName : "",
    );
    return {
      ...n,
      birthDate: "",
      street: "",
      postalCode: "",
      city: "",
      country: "DE",
    };
  }
  return emptyDraft();
}

function emptyDraft(): PersonalProfileDraft {
  return {
    firstName: "",
    lastName: "",
    birthDate: "",
    street: "",
    postalCode: "",
    city: "",
    country: "DE",
  };
}

function loadLocal(): PersonalProfileDraft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const raw = localStorage.getItem(USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY);
    if (!raw) return emptyDraft();
    const parsed: unknown = JSON.parse(raw);
    return readPersistedProfile(parsed);
  } catch {
    return emptyDraft();
  }
}

function rowToDraft(row: {
  given_name: string | null;
  family_name: string | null;
  birth_date: string | null;
  address_line1: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
}): PersonalProfileDraft {
  return {
    firstName: row.given_name ?? "",
    lastName: row.family_name ?? "",
    birthDate: row.birth_date ?? "",
    street: row.address_line1 ?? "",
    postalCode: row.address_postal_code ?? "",
    city: row.address_city ?? "",
    country: (row.address_country ?? "DE").trim() || "DE",
  };
}

/**
 * Persönliches Profil (Namen, Geburtstag, Adresse) — Supabase `profiles` oder
 * Workspace-/localStorage-Fallback. E-Mail kommt aus der Auth-Session und ist
 * nicht änderbar.
 */
export function usePersonalProfileNames() {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("DE");
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
      let draft = emptyDraft();
      let mail = "";

      if (workspacePersistenceConfigured()) {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          mail = user.email ?? "";
          const { data: prof } = await supabase
            .from("profiles")
            .select(
              "given_name, family_name, birth_date, address_line1, address_postal_code, address_city, address_country",
            )
            .eq("id", user.id)
            .maybeSingle();
          if (!cancelled && prof) {
            draft = rowToDraft(prof);
          }
        }
      }

      const namesEmpty = !draft.firstName.trim() && !draft.lastName.trim();
      const addressEmpty =
        !draft.birthDate &&
        !draft.street.trim() &&
        !draft.postalCode.trim() &&
        !draft.city.trim();

      if (namesEmpty && addressEmpty) {
        const remote = await loadWorkspaceJson(
          USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
        );
        if (supabaseOnly) {
          draft =
            remote && typeof remote === "object" && !Array.isArray(remote)
              ? readPersistedProfile(remote)
              : emptyDraft();
        } else if (
          remote &&
          typeof remote === "object" &&
          !Array.isArray(remote)
        ) {
          draft = readPersistedProfile(remote);
          try {
            localStorage.setItem(
              USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
              JSON.stringify(remote),
            );
          } catch {
            /* ignore */
          }
        } else {
          draft = loadLocal();
        }
      }

      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        setEmail(mail);
        setFirstName(draft.firstName);
        setLastName(draft.lastName);
        setBirthDate(draft.birthDate);
        setStreet(draft.street);
        setPostalCode(draft.postalCode);
        setCity(draft.city);
        setCountry(draft.country || "DE");
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

  const save = useCallback(async (): Promise<boolean> => {
    const f = firstName.trim();
    const l = lastName.trim();
    const bd = birthDate.trim();
    const st = street.trim();
    const pc = postalCode.trim();
    const ci = city.trim();
    const co = country.trim() || "DE";

    const prev = {
      firstName,
      lastName,
      birthDate,
      street,
      postalCode,
      city,
      country,
    };
    setFirstName(f);
    setLastName(l);
    setStreet(st);
    setPostalCode(pc);
    setCity(ci);
    setCountry(co);
    setBirthDate(bd);

    if (workspacePersistenceConfigured()) {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({
            given_name: f,
            family_name: l,
            birth_date: bd ? bd : null,
            address_line1: st || null,
            address_postal_code: pc || null,
            address_city: ci || null,
            address_country: co,
          })
          .eq("id", user.id);
        if (error) {
          setFirstName(prev.firstName);
          setLastName(prev.lastName);
          setBirthDate(prev.birthDate);
          setStreet(prev.street);
          setPostalCode(prev.postalCode);
          setCity(prev.city);
          setCountry(prev.country);
          failSave();
          return false;
        }
        toast.success("Profil gespeichert");
        return true;
      }
    }

    const payload: PersistedV3 = {
      version: 3,
      firstName: f,
      lastName: l,
      birthDate: bd,
      street: st,
      postalCode: pc,
      city: ci,
      country: co,
    };
    const ok = await persistWorkspaceState(
      USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
      payload,
    );
    if (!ok) {
      setFirstName(prev.firstName);
      setLastName(prev.lastName);
      setBirthDate(prev.birthDate);
      setStreet(prev.street);
      setPostalCode(prev.postalCode);
      setCity(prev.city);
      setCountry(prev.country);
      failSave();
      return false;
    }
    toast.success("Profil gespeichert");
    return true;
  }, [
    firstName,
    lastName,
    birthDate,
    street,
    postalCode,
    city,
    country,
    failSave,
  ]);

  return {
    email,
    firstName,
    lastName,
    birthDate,
    street,
    postalCode,
    city,
    country,
    setFirstName,
    setLastName,
    setBirthDate,
    setStreet,
    setPostalCode,
    setCity,
    setCountry,
    save,
    actor,
    resolvedFullName,
    isHydrated,
  };
}
