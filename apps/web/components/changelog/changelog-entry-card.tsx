import {
  formatChangelogPublishedAt,
  isChangelogEntryNew,
} from "@/lib/changelog/changelog-format";
import { parseChangelogBody } from "@/lib/changelog/changelog-body-sections";
import { stripMarkdownBold } from "@/lib/changelog/changelog-entry-normalize";
import {
  CHANGELOG_AUDIENCE_LABELS,
  type PlatformChangelogEntry,
} from "@/lib/types/platform-changelog";
import { cn } from "@/lib/utils";

export const changelogSuperadminEntryCardClassName =
  "border-violet-500/35 bg-violet-500/[0.05]";

export const changelogSuperadminSectionClassName =
  "mt-4 rounded-xl border border-violet-500/30 bg-violet-500/[0.07] px-3 py-3 sm:px-4";

export function ChangelogEntryBody({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  const lines = body.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;

  const allBullets = lines.every((line) => /^[-•*]\s/.test(line.trim()));

  if (allBullets) {
    return (
      <ul
        className={cn(
          "list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground",
          className,
        )}
      >
        {lines.map((line, i) => (
          <li key={i}>{stripMarkdownBold(line.trim().replace(/^[-•*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2 text-sm leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (/^[-•*]\s/.test(trimmed)) {
          return (
            <p key={i} className="pl-4 before:mr-2 before:content-['•']">
              {stripMarkdownBold(trimmed.replace(/^[-•*]\s+/, ""))}
            </p>
          );
        }
        return <p key={i}>{stripMarkdownBold(trimmed)}</p>;
      })}
    </div>
  );
}

export function ChangelogEntryCard({
  entry,
  className,
  showAudienceBadge = false,
  showSuperadminSections = false,
  actions,
}: {
  entry: PlatformChangelogEntry;
  className?: string;
  showAudienceBadge?: boolean;
  /** Superadmin sieht internen Zusatzteil farblich abgesetzt. */
  showSuperadminSections?: boolean;
  actions?: React.ReactNode;
}) {
  const isNew = isChangelogEntryNew(entry.publishedAt);
  const isSuperadminOnlyEntry = entry.audience === "superadmin";
  const { customerBody, superadminBody } = parseChangelogBody(entry.body);

  const visibleCustomerBody = isSuperadminOnlyEntry ? "" : customerBody;
  const visibleSuperadminBody = isSuperadminOnlyEntry
    ? entry.body
    : showSuperadminSections
      ? superadminBody
      : "";

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/50 bg-card p-4 shadow-card sm:p-5",
        isSuperadminOnlyEntry && changelogSuperadminEntryCardClassName,
        className,
      )}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {entry.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatChangelogPublishedAt(entry.publishedAt)}
            {entry.version ? (
              <span className="ml-2 font-mono">v{entry.version}</span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {showAudienceBadge && isSuperadminOnlyEntry ? (
            <span className="rounded-full border border-violet-500/35 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-800 dark:text-violet-200">
              {CHANGELOG_AUDIENCE_LABELS.superadmin}
            </span>
          ) : null}
          {isNew ? (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground shadow-sm">
              Neu
            </span>
          ) : null}
          {actions}
        </div>
      </header>

      {visibleCustomerBody ? (
        <ChangelogEntryBody body={visibleCustomerBody} />
      ) : null}

      {visibleSuperadminBody ? (
        <div
          className={cn(
            visibleCustomerBody && changelogSuperadminSectionClassName,
          )}
        >
          <p className="mb-2 text-xs font-medium text-violet-800 dark:text-violet-200">
            Intern · nur Superadmin
          </p>
          <ChangelogEntryBody
            body={visibleSuperadminBody}
            className="text-violet-950/80 dark:text-violet-100/85 [&_li]:marker:text-violet-600/70"
          />
        </div>
      ) : null}
    </article>
  );
}
