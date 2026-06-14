/** Kritisches Above-the-fold CSS für Marketing-LCP — inline vor dem globalen Bundle. */
export const MARKETING_CRITICAL_CSS = `
.gwada-hero-blob{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px);will-change:transform}
@media (prefers-reduced-motion:reduce){.gwada-hero-blob{animation:none!important}}
.gwada-hero-blob-a{width:min(92vw,620px);height:min(92vw,620px);left:-14%;top:-12%;background:radial-gradient(circle at 45% 42%,rgba(99,91,255,.88) 0%,rgba(129,140,248,.35) 42%,transparent 68%)}
.gwada-hero-blob-b{width:min(88vw,540px);height:min(88vw,540px);right:-18%;top:4%;background:radial-gradient(circle at 55% 48%,rgba(244,114,182,.72) 0%,rgba(236,72,153,.38) 45%,transparent 70%)}
.gwada-hero-static-gradient{background:radial-gradient(ellipse 120% 80% at 50% 38%,rgba(99,91,255,.52) 0%,rgba(236,72,153,.34) 32%,rgba(34,211,238,.28) 52%,#f4f6fd 100%)}
@keyframes landing-hero-rise{from{transform:translate3d(0,var(--landing-hero-rise-y,14px),0)}to{transform:translate3d(0,0,0)}}
.landing-hero-rise-logo{--landing-hero-rise-y:14px;animation:landing-hero-rise .55s cubic-bezier(.22,1,.36,1) both}
.landing-hero-rise-h1{--landing-hero-rise-y:20px;animation:landing-hero-rise .65s cubic-bezier(.22,1,.36,1) .06s both}
@media (prefers-reduced-motion:reduce){.landing-hero-rise-logo,.landing-hero-rise-h1{animation:none}}
`.trim();
