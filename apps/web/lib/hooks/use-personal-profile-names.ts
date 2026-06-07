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
  normalizeUserNicknameInput,
  USER_NICKNAME_TAKEN_MESSAGE,
  validateUserNicknameInput,
} from "@/lib/profile/user-nickname";
import { readLegacyRestaurantAppStatePayload } from "@/lib/supabase/legacy-restaurant-app-state";
import {
  isPersonalProfileRowEmpty,
  personalProfileDraftToRow,
  updatePersonalProfileRow,
} from "@/lib/supabase/personal-profile-db";
import {
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
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
type PersistedV4 = Omit<PersistedV3, "version"> & { version: 4; nickname: string };
type PersistedV2 = { version: 2; firstName: string; lastName: string };
type PersistedV1 = { version: 1; displayName: string };

export type PersonalProfileDraft = {
  firstName: string;
  lastName: string;
  nickname: string;
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
  if (v === 4) {
    const p = parsed as PersistedV4;
    return {
      firstName: typeof p.firstName === "string" ? p.firstName : "",
      lastName: typeof p.lastName === "string" ? p.lastName : "",
      nickname: typeof p.nickname === "string" ? p.nickname : "",
      birthDate: typeof p.birthDate === "string" ? p.birthDate : "",
      street: typeof p.street === "string" ? p.street : "",
      postalCode: typeof p.postalCode === "string" ? p.postalCode : "",
      city: typeof p.city === "string" ? p.city : "",
      country: typeof p.country === "string" ? p.country : "DE",
    };
  }
  if (v === 3) {
    const p = parsed as PersistedV3;
    return {
      firstName: typeof p.firstName === "string" ? p.firstName : "",
      lastName: typeof p.lastName === "string" ? p.lastName : "",
      nickname: "",
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
      nickname: "",
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
      nickname: "",
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
    nickname: "",
    birthDate: "",
    street: "",
    postalCode: "",
    city: "",
    country: "DE",
  };
}

function isDraftEmpty(draft: PersonalProfileDraft): boolean {
  return (
    !draft.firstName.trim() &&
    !draft.lastName.trim() &&
    !draft.nickname.trim() &&
    !draft.birthDate &&
    !draft.street.trim() &&
    !draft.postalCode.trim() &&
    !draft.city.trim()
  );
}

function loadLocal(): PersonalProfileDraft {
  const raw = loadWorkspaceJsonLocal(USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY);
  return raw ? readPersistedProfile(raw) : emptyDraft();
}

function draftToPersistedV4(draft: PersonalProfileDraft): PersistedV4 {
  return {
    version: 4,
    firstName: draft.firstName,
    lastName: draft.lastName,
    nickname: draft.nickname,
    birthDate: draft.birthDate,
    street: draft.street,
    postalCode: draft.postalCode,
    city: draft.city,
    country: draft.country,
  };
}

async function migrateLegacyPersonalProfileIfEmpty(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  userId: string,
  currentRow: {
    given_name: string | null;
    family_name: string | null;
    nickname: string | null;
    birth_date: string | null;
    address_line1: string | null;
    address_postal_code: string | null;
    address_city: string | null;
  } | null,
): Promise<PersonalProfileDraft | null> {
  if (currentRow && !isPersonalProfileRowEmpty(currentRow)) {
    return null;
  }

  let legacyDraft = loadLocal();
  if (isDraftEmpty(legacyDraft)) {
    const remote = await readLegacyRestaurantAppStatePayload(
      USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
    );
    if (remote) {
      legacyDraft = readPersistedProfile(remote);
    }
  }

  if (isDraftEmpty(legacyDraft)) {
    return null;
  }

  const { ok } = await updatePersonalProfileRow(
    supabase,
    userId,
    personalProfileDraftToRow(legacyDraft),
  );
  if (ok) {
    mirrorWorkspaceJsonLocal(
      USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
      draftToPersistedV4(legacyDraft),
    );
    return legacyDraft;
  }
  return legacyDraft;
}

function rowToDraft(row: {
  given_name: string | null;
  family_name: string | null;
  nickname: string | null;
  birth_date: string | null;
  address_line1: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
}): PersonalProfileDraft {
  return {
    firstName: row.given_name ?? "",
    lastName: row.family_name ?? "",
    nickname: row.nickname ?? "",
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
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("DE");
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarStoragePath, setAvatarStoragePath] = useState<string | null>(null);
  const [coverStoragePath, setCoverStoragePath] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(
    !workspacePersistenceConfigured(),
  );
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

    const localDraft = loadLocal();
    if (!isDraftEmpty(localDraft)) {
      setFirstName(localDraft.firstName);
      setLastName(localDraft.lastName);
      setNickname(localDraft.nickname);
      setBirthDate(localDraft.birthDate);
      setStreet(localDraft.street);
      setPostalCode(localDraft.postalCode);
      setCity(localDraft.city);
      setCountry(localDraft.country || "DE");
    }
    setIsHydrated(true);

    void (async () => {
      let draft = localDraft;
      let mail = "";

      if (workspacePersistenceConfigured()) {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (user) {
          mail = user.email ?? "";
          const { data: prof } = await supabase
            .from("profiles")
            .select(
              "given_name, family_name, nickname, birth_date, address_line1, address_postal_code, address_city, address_country, avatar_storage_path, cover_storage_path",
            )
            .eq("id", user.id)
            .maybeSingle();
          if (!cancelled && prof) {
            draft = rowToDraft(prof);
            setUserId(user.id);
            setAvatarStoragePath(
              typeof prof.avatar_storage_path === "string"
                ? prof.avatar_storage_path
                : null,
            );
            setCoverStoragePath(
              typeof prof.cover_storage_path === "string"
                ? prof.cover_storage_path
                : null,
            );
            if (isPersonalProfileRowEmpty(prof)) {
              const migrated = await migrateLegacyPersonalProfileIfEmpty(
                supabase,
                user.id,
                prof,
              );
              if (migrated) draft = migrated;
            }
          } else if (!cancelled) {
            setUserId(user.id);
            const migrated = await migrateLegacyPersonalProfileIfEmpty(
              supabase,
              user.id,
              null,
            );
            if (migrated) draft = migrated;
          }
        }
      }

      if (isDraftEmpty(draft)) {
        draft = loadLocal();
      }

      if (cancelled) return;
      setEmail(mail);
      setFirstName(draft.firstName);
      setLastName(draft.lastName);
      setNickname(draft.nickname);
      setBirthDate(draft.birthDate);
      setStreet(draft.street);
      setPostalCode(draft.postalCode);
      setCity(draft.city);
      setCountry(draft.country || "DE");
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
    const nickRaw = nickname.trim();
    const nickNormalized = nickRaw ? normalizeUserNicknameInput(nickRaw) : "";
    const nickValidation = validateUserNicknameInput(nickname);
    if (nickValidation) {
      toast.error(nickValidation);
      return false;
    }
    const bd = birthDate.trim();
    const st = street.trim();
    const pc = postalCode.trim();
    const ci = city.trim();
    const co = country.trim() || "DE";

    const prev = {
      firstName,
      lastName,
      nickname,
      birthDate,
      street,
      postalCode,
      city,
      country,
    };
    setFirstName(f);
    setLastName(l);
    setNickname(nickNormalized);
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
            nickname: nickNormalized || null,
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
          setNickname(prev.nickname);
          setBirthDate(prev.birthDate);
          setStreet(prev.street);
          setPostalCode(prev.postalCode);
          setCity(prev.city);
          setCountry(prev.country);
          if (error.code === "23505") {
            toast.error(USER_NICKNAME_TAKEN_MESSAGE);
          } else {
            failSave();
          }
          return false;
        }
        mirrorWorkspaceJsonLocal(
          USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
          draftToPersistedV4({
            firstName: f,
            lastName: l,
            nickname: nickNormalized,
            birthDate: bd,
            street: st,
            postalCode: pc,
            city: ci,
            country: co,
          }),
        );
        toast.success("Profil gespeichert");
        return true;
      }
    }

    const payload = draftToPersistedV4({
      firstName: f,
      lastName: l,
      nickname: nickNormalized,
      birthDate: bd,
      street: st,
      postalCode: pc,
      city: ci,
      country: co,
    });
    const ok = mirrorWorkspaceJsonLocal(
      USER_PERSONAL_PROFILE_NAMES_STORAGE_KEY,
      payload,
    );
    if (!ok) {
      setFirstName(prev.firstName);
      setLastName(prev.lastName);
      setNickname(prev.nickname);
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
    nickname,
    birthDate,
    street,
    postalCode,
    city,
    country,
    failSave,
  ]);

  const patchImagePaths = useCallback(
    (paths: {
      avatarStoragePath?: string | null;
      coverStoragePath?: string | null;
    }) => {
      if (paths.avatarStoragePath !== undefined) {
        setAvatarStoragePath(paths.avatarStoragePath);
      }
      if (paths.coverStoragePath !== undefined) {
        setCoverStoragePath(paths.coverStoragePath);
      }
    },
    [],
  );

  return {
    email,
    userId,
    firstName,
    lastName,
    nickname,
    birthDate,
    street,
    postalCode,
    city,
    country,
    avatarStoragePath,
    coverStoragePath,
    setFirstName,
    setLastName,
    setNickname,
    setBirthDate,
    setStreet,
    setPostalCode,
    setCity,
    setCountry,
    patchImagePaths,
    save,
    actor,
    resolvedFullName,
    isHydrated,
  };
}
