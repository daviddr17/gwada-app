"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SettingsNavSection = {
  id: string;
  label: string;
};

const HEADER_PX = 56;
/** Standard: Abstand unter dem App-Header, ab dem eine Sektion als „im Blick“ gilt. */
const DEFAULT_ACTIVATION_OFFSET_BELOW_HEADER = 88;

function pickActiveSection(
  ids: string[],
  offsetBelowHeader: number,
): string | null {
  if (typeof window === "undefined" || ids.length === 0) {
    return ids[0] ?? null;
  }
  const line = HEADER_PX + offsetBelowHeader;
  let best: string | null = null;
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const top = el.getBoundingClientRect().top;
    if (top <= line) best = id;
  }
  return best ?? ids[0] ?? null;
}

export type SettingsSectionSpyOptions = {
  /** Zusätzlicher Abstand unter dem fixen App-Header (px) für die Scroll-Spy-Linie. */
  activationOffsetBelowHeader?: number;
};

/** Ein Scroll-Listener für alle Sektions-Navigationsleisten gemeinsam. */
export function useSettingsSectionSpy(
  sections: SettingsNavSection[],
  options?: SettingsSectionSpyOptions,
) {
  const offsetBelowHeader =
    options?.activationOffsetBelowHeader ?? DEFAULT_ACTIVATION_OFFSET_BELOW_HEADER;

  const sectionIds = React.useMemo(
    () => sections.map((s) => s.id),
    [sections],
  );

  const [activeId, setActiveId] = React.useState<string>(
    () => sectionIds[0] ?? "",
  );

  React.useEffect(() => {
    const first = sectionIds[0];
    if (!first) return;
    setActiveId((prev) => (sectionIds.includes(prev) ? prev : first));
  }, [sectionIds]);

  const updateActive = React.useCallback(() => {
    const next = pickActiveSection(sectionIds, offsetBelowHeader);
    if (next) setActiveId((prev) => (prev === next ? prev : next));
  }, [sectionIds, offsetBelowHeader]);

  React.useEffect(() => {
    updateActive();
  }, [updateActive]);

  React.useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateActive();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [updateActive]);

  const scrollToSection = React.useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return { activeId, scrollToSection };
}

export function SettingsSectionNav({
  sections,
  activeId,
  onNavigate,
  className,
  orientation = "vertical",
}: {
  sections: SettingsNavSection[];
  activeId: string;
  onNavigate: (id: string) => void;
  className?: string;
  orientation?: "vertical" | "horizontal";
}) {
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      className={cn(
        "flex",
        isHorizontal
          ? "max-w-full min-w-0 gap-1 overflow-x-auto py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "w-full flex-col items-end gap-1.5",
        className,
      )}
      aria-label="Abschnitte der Einstellungen"
    >
      {sections.map((s) => {
        const active = activeId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onNavigate(s.id)}
            className={cn(
              "shrink-0 rounded-full border transition-[color,background-color,border-color,box-shadow,font-weight,font-size,padding] duration-200 ease-out motion-reduce:transition-none",
              isHorizontal
                ? "px-3 py-1.5 text-left text-sm"
                : "max-w-[min(100%,14rem)] px-3 py-2 text-right transition-[transform,font-size,color,background-color,border-color,padding] duration-500 ease-out will-change-transform motion-reduce:transition-none",
              active
                ? cn(
                    "border-border bg-muted/80 font-semibold text-foreground shadow-sm",
                    !isHorizontal &&
                      "origin-right scale-[1.08] text-base md:scale-[1.1] md:text-[1.05rem]",
                  )
                : cn(
                    "border-transparent bg-transparent text-sm font-normal text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground",
                    !isHorizontal && "origin-center scale-100",
                  ),
            )}
          >
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
