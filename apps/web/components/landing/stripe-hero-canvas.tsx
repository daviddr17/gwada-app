/**
 * Stripe-ähnlicher Hero: große, weich geblurte Farb-Orbs per CSS-Animation
 * (zuverlässig sichtbar in Safari/Chrome). Keine Maus-Parallax — die Glas-Karte
 * in `LandingHero` bewegt sich separat, der Farb-Background bleibt ruhig.
 */
export function StripeHeroCanvas() {
  return (
    <>
      <div
        className="gwada-hero-static-gradient pointer-events-none absolute inset-0 z-0 hidden motion-reduce:block"
        aria-hidden
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden"
      >
        <div className="absolute inset-0 bg-[#f4f6fd] dark:bg-[#0b1020]" />

        <div
          className="gwada-hero-blob gwada-hero-blob-a motion-safe:animate-[gwada-hero-blob-a_22s_ease-in-out_infinite]"
          aria-hidden
        />
        <div
          className="gwada-hero-blob gwada-hero-blob-b motion-safe:animate-[gwada-hero-blob-b_26s_ease-in-out_infinite]"
          aria-hidden
        />
        <div
          className="gwada-hero-blob gwada-hero-blob-c motion-safe:animate-[gwada-hero-blob-c_20s_ease-in-out_infinite]"
          aria-hidden
        />
        <div
          className="gwada-hero-blob gwada-hero-blob-d motion-safe:animate-[gwada-hero-blob-d_24s_ease-in-out_infinite]"
          aria-hidden
        />

        <div
          className="pointer-events-none absolute inset-0 mix-blend-screen opacity-40 dark:opacity-35"
          style={{
            background:
              "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.14) 45%, transparent 70%)",
          }}
          aria-hidden
        />
      </div>
    </>
  );
}
