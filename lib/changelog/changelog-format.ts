import { CHANGELOG_NEW_DAYS } from "@/lib/types/platform-changelog";

export function formatChangelogPublishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function isChangelogEntryNew(publishedAt: string): boolean {
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = Date.now() - CHANGELOG_NEW_DAYS * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
}

/** `datetime-local` → ISO (Browser lokal, Speicherung UTC). */
export function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ISO → `datetime-local` für Formularfelder. */
export function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
