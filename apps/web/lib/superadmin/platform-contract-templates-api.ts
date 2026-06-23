import type {
  PlatformStaffContractTemplate,
  PlatformStaffContractTemplateInput,
} from "@/lib/types/platform-contract-templates";

export async function fetchSuperadminPlatformContractTemplates(params?: {
  countryCode?: string;
}): Promise<
  | { ok: true; templates: PlatformStaffContractTemplate[] }
  | { ok: false; error: string }
> {
  const url = new URL("/api/superadmin/contract-templates", window.location.origin);
  if (params?.countryCode) {
    url.searchParams.set("countryCode", params.countryCode);
  }

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    templates?: PlatformStaffContractTemplate[];
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "load_failed" };
  }

  return { ok: true, templates: json.templates ?? [] };
}

export async function fetchSuperadminPlatformContractTemplate(
  templateId: string,
): Promise<
  | { ok: true; template: PlatformStaffContractTemplate }
  | { ok: false; error: string }
> {
  const res = await fetch(`/api/superadmin/contract-templates/${templateId}`);
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    template?: PlatformStaffContractTemplate;
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "load_failed" };
  }

  if (!json.template) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, template: json.template };
}

export async function saveSuperadminPlatformContractTemplate(
  input: PlatformStaffContractTemplateInput,
  templateId?: string | null,
): Promise<
  | { ok: true; template: PlatformStaffContractTemplate }
  | { ok: false; error: string }
> {
  const res = await fetch(
    templateId
      ? `/api/superadmin/contract-templates/${templateId}`
      : "/api/superadmin/contract-templates",
    {
      method: templateId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    template?: PlatformStaffContractTemplate;
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "save_failed" };
  }

  if (!json.template) {
    return { ok: false, error: "unexpected_response" };
  }

  return { ok: true, template: json.template };
}

export async function deleteSuperadminPlatformContractTemplate(
  templateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/superadmin/contract-templates/${templateId}`, {
    method: "DELETE",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "delete_failed" };
  }

  return { ok: true };
}

export async function bumpSuperadminPlatformContractTemplateVersion(
  templateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(
    `/api/superadmin/contract-templates/${templateId}/bump-version`,
    { method: "POST" },
  );
  const json = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "bump_failed" };
  }

  return { ok: true };
}
