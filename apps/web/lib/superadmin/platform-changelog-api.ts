import type {
  PlatformChangelogEntry,
  PlatformChangelogEntryInput,
} from "@/lib/types/platform-changelog";

export async function fetchSuperadminChangelogEntries(): Promise<{
  entries: PlatformChangelogEntry[];
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/changelog", { cache: "no-store" });
  const data = (await res.json()) as {
    entries?: PlatformChangelogEntry[];
    error?: string;
  };
  if (!res.ok) {
    return { entries: [], error: data.error ?? "Laden fehlgeschlagen." };
  }
  return { entries: data.entries ?? [], error: null };
}

export async function createSuperadminChangelogEntry(
  input: PlatformChangelogEntryInput,
): Promise<{ entry: PlatformChangelogEntry | null; error: string | null }> {
  const res = await fetch("/api/superadmin/changelog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    entry?: PlatformChangelogEntry;
    error?: string;
  };
  if (!res.ok) {
    return { entry: null, error: data.error ?? "Speichern fehlgeschlagen." };
  }
  return { entry: data.entry ?? null, error: null };
}

export async function updateSuperadminChangelogEntry(
  id: string,
  input: PlatformChangelogEntryInput,
): Promise<{ entry: PlatformChangelogEntry | null; error: string | null }> {
  const res = await fetch(`/api/superadmin/changelog/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    entry?: PlatformChangelogEntry;
    error?: string;
  };
  if (!res.ok) {
    return { entry: null, error: data.error ?? "Speichern fehlgeschlagen." };
  }
  return { entry: data.entry ?? null, error: null };
}

export async function deleteSuperadminChangelogEntry(
  id: string,
): Promise<{ error: string | null }> {
  const res = await fetch(`/api/superadmin/changelog/${id}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { error: data.error ?? "Löschen fehlgeschlagen." };
  }
  return { error: null };
}

export type ChangelogGitSyncResult = {
  created: PlatformChangelogEntry[];
  skipped: string[];
  errors: string[];
};

export async function syncSuperadminChangelogFromGit(options?: {
  gitRange?: string;
}): Promise<{ result: ChangelogGitSyncResult | null; error: string | null }> {
  const res = await fetch("/api/superadmin/changelog/sync-from-git", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runGit: true,
      gitRange: options?.gitRange,
      archiveDraft: true,
    }),
  });
  const data = (await res.json()) as ChangelogGitSyncResult & { error?: string };
  if (!res.ok) {
    return { result: null, error: data.error ?? "Git-Sync fehlgeschlagen." };
  }
  return {
    result: {
      created: data.created ?? [],
      skipped: data.skipped ?? [],
      errors: data.errors ?? [],
    },
    error: null,
  };
}
