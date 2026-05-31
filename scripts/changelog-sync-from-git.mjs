#!/usr/bin/env node
/**
 * Liest Git-Commits (Changelog:-Block) und optional content/changelog.draft.json,
 * legt Einträge per API an (Dedup über source_git_sha).
 *
 * Env: CHANGELOG_SYNC_URL, CHANGELOG_SYNC_SECRET, CHANGELOG_GIT_RANGE
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GIT_FORMAT = "%H%x1f%s%x1f%b%x1f%aI%x1e";
const DRAFT_PATH = join(ROOT, "content/changelog.draft.json");

const SYNC_URL =
  process.env.CHANGELOG_SYNC_URL?.trim() ||
  "http://127.0.0.1:3000/api/superadmin/changelog/sync-from-git";
const SYNC_SECRET = process.env.CHANGELOG_SYNC_SECRET?.trim();

function resolveGitRange() {
  let range = process.env.CHANGELOG_GIT_RANGE?.trim() || "HEAD~30..HEAD";
  if (/^0+\.\./.test(range) || range.includes("000000000000")) {
    const sha = process.env.GITHUB_SHA?.trim() || "HEAD";
    range = `${sha}~1..${sha}`;
  }
  return range;
}

function extractGitRecords() {
  const range = resolveGitRange();
  const output = execFileSync(
    "git",
    ["log", range, `--format=${GIT_FORMAT}`, "--reverse"],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 10 * 1024 * 1024 },
  );
  return output
    .split("\x1e")
    .map((r) => r.trim())
    .filter(Boolean);
}

function readDraft() {
  if (!existsSync(DRAFT_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(DRAFT_PATH, "utf8"));
    if (!data?.title?.trim() || !data?.body?.trim()) return null;
    return {
      title: data.title.trim(),
      body: data.body.trim(),
      audience: data.audience === "superadmin" ? "superadmin" : "customers",
      version: data.version?.trim() || null,
    };
  } catch {
    return null;
  }
}

async function main() {
  const gitRecords = extractGitRecords();
  const draft = readDraft();

  const headers = { "Content-Type": "application/json" };
  if (SYNC_SECRET) {
    headers.Authorization = `Bearer ${SYNC_SECRET}`;
  }

  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      gitRecords,
      draft: draft ?? undefined,
      archiveDraft: Boolean(draft),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Changelog-Sync fehlgeschlagen:", data.error ?? res.status);
    process.exit(1);
  }

  console.log(
    `Changelog-Sync: ${data.created?.length ?? 0} neu, ${data.skipped?.length ?? 0} übersprungen`,
  );
  if (data.errors?.length) {
    console.error("Fehler:", data.errors.join("; "));
  }

  if (draft && existsSync(DRAFT_PATH)) {
    renameSync(DRAFT_PATH, `${DRAFT_PATH}.synced`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
