import type {
  PlatformFoodMarking,
  PlatformFoodMarkingInput,
} from "@/lib/types/platform-food-markings";

export async function fetchSuperadminPlatformFoodMarkings(params?: {
  countryCode?: string;
}): Promise<
  | { ok: true; markings: PlatformFoodMarking[] }
  | { ok: false; error: string }
> {
  const url = new URL(
    "/api/superadmin/food-markings",
    window.location.origin,
  );
  if (params?.countryCode) {
    url.searchParams.set("countryCode", params.countryCode);
  }

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    markings?: PlatformFoodMarking[];
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "load_failed" };
  }

  return { ok: true, markings: json.markings ?? [] };
}

export async function fetchSuperadminPlatformFoodMarking(
  markingId: string,
): Promise<
  | { ok: true; marking: PlatformFoodMarking }
  | { ok: false; error: string }
> {
  const res = await fetch(`/api/superadmin/food-markings/${markingId}`);
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    marking?: PlatformFoodMarking;
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "load_failed" };
  }

  if (!json.marking) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, marking: json.marking };
}

export async function saveSuperadminPlatformFoodMarking(
  input: PlatformFoodMarkingInput,
  markingId?: string | null,
): Promise<
  | { ok: true; marking: PlatformFoodMarking }
  | { ok: false; error: string }
> {
  const res = await fetch(
    markingId
      ? `/api/superadmin/food-markings/${markingId}`
      : "/api/superadmin/food-markings",
    {
      method: markingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    marking?: PlatformFoodMarking;
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "save_failed" };
  }

  if (!json.marking) {
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, marking: json.marking };
}

export async function deleteSuperadminPlatformFoodMarking(
  markingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/superadmin/food-markings/${markingId}`, {
    method: "DELETE",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "delete_failed" };
  }
  return { ok: true };
}
