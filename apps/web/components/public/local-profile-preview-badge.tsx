/** Nur in `npm run dev` — Hinweis auf Beispieldaten im öffentlichen Profil. */
export function LocalProfilePreviewBadge() {
  return (
    <div
      className="pointer-events-none fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] rounded-full border border-amber-600/25 bg-amber-400/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-amber-950 shadow-sm backdrop-blur-sm"
      aria-hidden
    >
      Lokale Vorschau
    </div>
  );
}
