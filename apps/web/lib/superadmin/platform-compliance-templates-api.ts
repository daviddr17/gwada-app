import type {
  PlatformComplianceChecklistTemplate,
  PlatformComplianceChecklistTemplateInput,
} from "@/lib/types/platform-compliance-templates";

export async function fetchSuperadminPlatformComplianceTemplates(params?: {
  countryCode?: string;
}): Promise<
  | { ok: true; templates: PlatformComplianceChecklistTemplate[] }
  | { ok: false; error: string }
> {
  const url = new URL("/api/superadmin/compliance-templates", window.location.origin);
  if (params?.countryCode) {
    url.searchParams.set("countryCode", params.countryCode);
  }

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    templates?: PlatformComplianceChecklistTemplate[];
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "load_failed" };
  }

  return { ok: true, templates: json.templates ?? [] };
}

export async function fetchSuperadminPlatformComplianceTemplate(
  templateId: string,
): Promise<
  | { ok: true; template: PlatformComplianceChecklistTemplate }
  | { ok: false; error: string }
> {
  const res = await fetch(`/api/superadmin/compliance-templates/${templateId}`);
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    template?: PlatformComplianceChecklistTemplate;
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "load_failed" };
  }

  if (!json.template) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, template: json.template };
}

export async function saveSuperadminPlatformComplianceTemplate(
  input: PlatformComplianceChecklistTemplateInput,
  templateId?: string | null,
): Promise<
  | { ok: true; template: PlatformComplianceChecklistTemplate }
  | { ok: false; error: string }
> {
  const res = await fetch(
    templateId
      ? `/api/superadmin/compliance-templates/${templateId}`
      : "/api/superadmin/compliance-templates",
    {
      method: templateId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    template?: PlatformComplianceChecklistTemplate;
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "save_failed" };
  }

  if (!json.template) {
    return { ok: false, error: "unexpected_response" };
  }

  return { ok: true, template: json.template };
}

export async function deleteSuperadminPlatformComplianceTemplate(
  templateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/superadmin/compliance-templates/${templateId}`, {
    method: "DELETE",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "delete_failed" };
  }

  return { ok: true };
}

export async function bumpSuperadminPlatformComplianceTemplateVersion(
  templateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(
    `/api/superadmin/compliance-templates/${templateId}/bump-version`,
    { method: "POST" },
  );
  const json = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "bump_failed" };
  }

  return { ok: true };
}
