"use client";

import { ChangelogOverview } from "@/components/changelog/changelog-overview";

export default function ChangelogPage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Was sich für dich in der App ändert — verständlich erklärt, ohne Technik-Kauderwelsch.
      </p>
      <ChangelogOverview />
    </div>
  );
}
