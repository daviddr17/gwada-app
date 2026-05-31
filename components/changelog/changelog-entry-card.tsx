import {
  formatChangelogPublishedAt,
  isChangelogEntryNew,
} from "@/lib/changelog/changelog-format";
import {
  CHANGELOG_AUDIENCE_LABELS,
  type PlatformChangelogEntry,
} from "@/lib/types/platform-changelog";
import { cn } from "@/lib/utils";

export function ChangelogEntryBody({ body }: { body: string }) {
  const lines = body.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;

  const allBullets = lines.every((line) => /^[-•*]\s/.test(line.trim()));

  if (allBullets) {
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {lines.map((line, i) => (
          <li key={i}>{line.trim().replace(/^[-•*]\s+/, "")}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (/^[-•*]\s/.test(trimmed)) {
          return (
            <p key={i} className="pl-4 before:mr-2 before:content-['•']">
              {trimmed.replace(/^[-•*]\s+/, "")}
            </p>
          );
        }
        return <p key={i}>{trimmed}</p>;
      })}
    </div>
  );
}

export function ChangelogEntryCard({
  entry,
  className,
  showAudienceBadge = false,
}: {
  entry: PlatformChangelogEntry;
  className?: string;
  showAudienceBadge?: boolean;
}) {
  const isNew = isChangelogEntryNew(entry.publishedAt);
  const isSuperadminOnly = entry.audience === "superadmin";

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/50 bg-card p-4 shadow-card sm:p-5",
        className,
      )}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1 pr-16 sm:pr-20">
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
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {showAudienceBadge && isSuperadminOnly ? (
            <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {CHANGELOG_AUDIENCE_LABELS.superadmin}
            </span>
          ) : null}
          {isNew ? (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              Neu
            </span>
          ) : null}
        </div>
      </header>
      <ChangelogEntryBody body={entry.body} />
    </article>
  );
}
