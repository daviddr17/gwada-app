import "server-only";

export const DEFAULT_CHANGELOG_GIT_MAX_COMMITS = 30;

/**
 * `HEAD~30..HEAD` scheitert bei wenigen Commits / Shallow-Clones.
 * `-30` / `HEAD~N..HEAD` → N; sonst Default.
 */
export function resolveChangelogGitCommitLimit(
  range?: string | null,
): number {
  const trimmed = range?.trim();
  const headRange = trimmed?.match(/^HEAD~(\d+)\.\.HEAD$/i);
  if (headRange) {
    const n = Number.parseInt(headRange[1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (trimmed && /^-\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed.slice(1), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_CHANGELOG_GIT_MAX_COMMITS;
}
