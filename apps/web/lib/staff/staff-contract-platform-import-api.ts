import type { PlatformStaffContractCatalogItem } from "@/lib/types/platform-contract-templates";

export async function fetchPlatformContractCatalog(params: {
  restaurantId: string;
  employmentTypeId?: string | null;
}): Promise<
  | { ok: true; countryCode: string; items: PlatformStaffContractCatalogItem[] }
  | { ok: false; error: string }
> {
  const url = new URL(
    "/api/staff/contract-templates/platform-catalog",
    window.location.origin,
  );
  url.searchParams.set("restaurantId", params.restaurantId);
  if (params.employmentTypeId) {
    url.searchParams.set("employmentTypeId", params.employmentTypeId);
  }

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    countryCode?: string;
    items?: PlatformStaffContractCatalogItem[];
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "load_failed" };
  }

  return {
    ok: true,
    countryCode: json.countryCode ?? "DE",
    items: json.items ?? [],
  };
}

export async function importPlatformContractTemplates(params: {
  restaurantId: string;
  employmentTypeId?: string | null;
  platformTemplateIds?: string[];
  importAllForCountry?: boolean;
}): Promise<
  | { ok: true; imported: number; skipped: number; templateIds: string[] }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/staff/contract-templates/import-platform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    imported?: number;
    skipped?: number;
    templateIds?: string[];
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "import_failed" };
  }

  return {
    ok: true,
    imported: json.imported ?? 0,
    skipped: json.skipped ?? 0,
    templateIds: json.templateIds ?? [],
  };
}
