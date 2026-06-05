/** Dauer des Theme-Crossfade (View Transition / Fallback). */
export const THEME_TRANSITION_MS = 420;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Theme-Update mit sanftem Crossfade statt hartem Umschalten der CSS-Variablen. */
export function runThemeTransition(update: () => void): void {
  if (typeof document === "undefined" || prefersReducedMotion()) {
    update();
    return;
  }

  const root = document.documentElement;
  const startViewTransition = document.startViewTransition?.bind(document);

  if (!startViewTransition) {
    update();
    return;
  }

  root.classList.add("theme-transition-active");
  startViewTransition(() => {
    update();
  }).finished.finally(() => {
    window.setTimeout(() => {
      root.classList.remove("theme-transition-active");
    }, 0);
  });
}
