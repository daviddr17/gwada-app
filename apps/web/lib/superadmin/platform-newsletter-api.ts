import type { PlatformNewsletterDetail } from "@/lib/types/platform-newsletter";
import type { PlatformNewsletter } from "@/lib/types/platform-newsletter";
import type { PlatformChangelogEntry } from "@/lib/types/platform-changelog";

async function parseJson<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json()) as T & { error?: string };
}

export async function fetchSuperadminNewsletters(opts?: {
  templates?: boolean;
}): Promise<{ items: PlatformNewsletter[]; error?: string }> {
  const qs = opts?.templates ? "?templates=1" : "";
  const res = await fetch(`/api/superadmin/newsletter${qs}`, {
    cache: "no-store",
  });
  const data = await parseJson<{ items?: PlatformNewsletter[] }>(res);
  if (!res.ok) return { items: [], error: data.error ?? "Laden fehlgeschlagen" };
  return { items: data.items ?? [] };
}

export async function fetchSuperadminNewsletterDetail(
  id: string,
): Promise<{ item: PlatformNewsletterDetail | null; error?: string }> {
  const res = await fetch(`/api/superadmin/newsletter/${id}`, {
    cache: "no-store",
  });
  const data = await parseJson<{ item?: PlatformNewsletterDetail }>(res);
  if (!res.ok) {
    return { item: null, error: data.error ?? "Laden fehlgeschlagen" };
  }
  return { item: data.item ?? null };
}

export async function createSuperadminNewsletter(body: {
  title?: string;
  fromNewsletterId?: string;
  asTemplate?: boolean;
}): Promise<{ id?: string; error?: string }> {
  const res = await fetch("/api/superadmin/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{ id?: string }>(res);
}

export async function saveSuperadminNewsletter(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(`/api/superadmin/newsletter/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteSuperadminNewsletter(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(`/api/superadmin/newsletter/${id}`, {
    method: "DELETE",
  });
  return parseJson(res);
}

export async function duplicateSuperadminNewsletter(
  id: string,
  opts?: { asTemplate?: boolean },
): Promise<{ id?: string; error?: string }> {
  const res = await fetch(`/api/superadmin/newsletter/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return parseJson<{ id?: string }>(res);
}

export async function scheduleSuperadminNewsletter(
  id: string,
  scheduledAt: string | null,
): Promise<{ recipientCount?: number; error?: string }> {
  const res = await fetch(`/api/superadmin/newsletter/${id}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledAt }),
  });
  return parseJson(res);
}

export async function testSuperadminNewsletter(
  id: string,
  toEmail: string,
  locale?: string,
): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(`/api/superadmin/newsletter/${id}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toEmail, locale }),
  });
  return parseJson(res);
}

export async function previewSuperadminNewsletter(
  id: string,
  locale?: string,
): Promise<{ html?: string; subject?: string; error?: string }> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  const res = await fetch(`/api/superadmin/newsletter/${id}/preview${qs}`, {
    cache: "no-store",
  });
  return parseJson(res);
}

export async function uploadNewsletterBlockImage(
  newsletterId: string,
  file: File,
): Promise<{ path?: string; url?: string; error?: string }> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch(
    `/api/superadmin/newsletter/${newsletterId}/upload`,
    { method: "POST", body: fd },
  );
  return parseJson(res);
}

export async function fetchNewsletterChangelogSuggestions(): Promise<{
  entries: PlatformChangelogEntry[];
  error?: string;
}> {
  const res = await fetch("/api/superadmin/newsletter/changelog-suggestions", {
    cache: "no-store",
  });
  const data = await parseJson<{ entries?: PlatformChangelogEntry[] }>(res);
  if (!res.ok) {
    return { entries: [], error: data.error ?? "Laden fehlgeschlagen" };
  }
  return { entries: data.entries ?? [] };
}

export async function fetchNewsletterSubscriberCount(): Promise<{
  count: number;
  error?: string;
}> {
  const res = await fetch("/api/superadmin/newsletter/subscribers/count", {
    cache: "no-store",
  });
  const data = await parseJson<{ count?: number }>(res);
  if (!res.ok) return { count: 0, error: data.error };
  return { count: data.count ?? 0 };
}
