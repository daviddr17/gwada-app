import { flushSync } from "react-dom";

/** Dauer des Theme-Crossfade (View Transition / Fallback). */
export const THEME_TRANSITION_MS = 420;

export const THEME_VT_ACTIVE_CLASS = "theme-view-transition-active";

export const THEME_TRANSITION_START_EVENT = "gwada:theme-transition-start";
export const THEME_TRANSITION_END_EVENT = "gwada:theme-transition-end";

const FALLBACK_CLASS = "theme-transition-fallback";
const ACTIVE_CLASS = "theme-transition-active";
const VT_LOCK_ATTR = "data-gwada-theme-vt-lock";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Liest synchron den aktiven Theme-Crossfade (DOM-Klasse). */
export function isThemeTransitionPaused(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(THEME_VT_ACTIVE_CLASS);
}

function lockCssTransitionsDuringViewTransition(): () => void {
  const css = document.createElement("style");
  css.setAttribute(VT_LOCK_ATTR, "");
  css.textContent = `html.${THEME_VT_ACTIVE_CLASS} *,html.${THEME_VT_ACTIVE_CLASS} *::before,html.${THEME_VT_ACTIVE_CLASS} *::after{transition:none!important}`;
  document.head.appendChild(css);
  return () => {
    css.remove();
  };
}

function beginViewTransitionPhase(): () => void {
  const root = document.documentElement;
  root.classList.add(THEME_VT_ACTIVE_CLASS);
  window.dispatchEvent(new Event(THEME_TRANSITION_START_EVENT));
  return lockCssTransitionsDuringViewTransition();
}

function endViewTransitionPhase(unlock: () => void): void {
  unlock();
  document.documentElement.classList.remove(THEME_VT_ACTIVE_CLASS);
  window.dispatchEvent(new Event(THEME_TRANSITION_END_EVENT));
}

/**
 * Theme-Update mit einheitlichem Crossfade.
 * Mit View Transitions API: eine flächige Snapshot-Dissolve (keine *-Transitions).
 * Ohne VT: kurze einheitliche Property-Transitions auf allen Elementen.
 */
export function runThemeTransition(update: () => void): void {
  if (typeof document === "undefined" || prefersReducedMotion()) {
    update();
    return;
  }

  const root = document.documentElement;
  const startViewTransition = document.startViewTransition?.bind(document);

  if (startViewTransition) {
    const unlock = beginViewTransitionPhase();
    const transition = startViewTransition(() => {
      flushSync(update);
    });
    if (transition?.finished) {
      void transition.finished.finally(() => {
        endViewTransitionPhase(unlock);
      });
    } else {
      window.setTimeout(() => {
        endViewTransitionPhase(unlock);
      }, THEME_TRANSITION_MS + 32);
    }
    return;
  }

  root.classList.add(FALLBACK_CLASS, ACTIVE_CLASS);
  update();
  window.setTimeout(() => {
    root.classList.remove(FALLBACK_CLASS, ACTIVE_CLASS);
  }, THEME_TRANSITION_MS + 32);
}
