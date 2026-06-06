const DEFAULT_GITHUB_REPO_SLUG = "daviddr17/gwada-app";

/** `owner/repo` aus Slug, HTTPS-URL oder `.git`-Suffix. */
export function normalizeGithubRepoSlug(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  let slug = raw.trim();
  slug = slug.replace(/^https:\/\/github\.com\//i, "");
  slug = slug.replace(/\.git$/i, "");
  slug = slug.replace(/\/+$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(slug)) return null;
  return slug;
}

export function resolveGithubRepoSlug(): string {
  for (const candidate of [
    process.env.GWADA_GITHUB_REPO,
    process.env.CHANGELOG_GIT_REPO,
  ]) {
    const slug = normalizeGithubRepoSlug(candidate);
    if (slug) return slug;
  }
  return DEFAULT_GITHUB_REPO_SLUG;
}
