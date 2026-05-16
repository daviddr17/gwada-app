"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY } from "@/lib/constants/user-identity";
import type { OrderProtocolActor } from "@/lib/types/purchase-order";
import { formatOrderProtocolUserName } from "@/lib/types/purchase-order";
import { toastStorageError } from "@/lib/persist-notify";

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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const { firstName: f, lastName: l } = load();
    const frame = requestAnimationFrame(() => {
      setFirstName(f);
      setLastName(l);
      setIsHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

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
    const payload: PersistedV2 = {
      version: 2,
      firstName: f,
      lastName: l,
    };
    try {
      localStorage.setItem(
        USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
        JSON.stringify(payload),
      );
      setFirstName(f);
      setLastName(l);
      toast.success("Vor- und Nachname gespeichert");
      return true;
    } catch (e) {
      console.error(e);
      toastStorageError();
      return false;
    }
  }, [firstName, lastName]);

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
