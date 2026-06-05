"use client";

import dynamic from "next/dynamic";

const ModeToggle = dynamic(
  () => import("@/components/theme/mode-toggle").then((mod) => mod.ModeToggle),
  { ssr: false, loading: () => null },
);

/** Theme-Schalter — Framer erst nach First Paint. */
export function PublicThemeToggleDeferred({
  className,
  toggleClassName,
}: {
  className?: string;
  toggleClassName?: string;
}) {
  return (
    <div
      className={
        className ??
        "pointer-events-none fixed right-5 top-5 z-[60] flex gap-2 md:right-8 md:top-8"
      }
    >
      <div className="pointer-events-auto">
        <ModeToggle className={toggleClassName} />
      </div>
    </div>
  );
}
