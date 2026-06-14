import { MARKETING_CRITICAL_CSS } from "@/lib/marketing/marketing-critical-css";

/** Inline-Critical-CSS für Hero-LCP auf Marketing-Routen. */
export function MarketingCriticalCss() {
  return (
    <style
      data-marketing-critical=""
      dangerouslySetInnerHTML={{ __html: MARKETING_CRITICAL_CSS }}
    />
  );
}
