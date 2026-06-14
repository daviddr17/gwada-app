"use client";

import { useEffect, useState } from "react";
import { EMBED_BRAND_FOOTER_LOGO_PATH } from "@/lib/embed/embed-brand-footer";
import { cn } from "@/lib/utils";

type EmbedBrandInfo = {
  appName: string;
  logoUrl: string | null;
};

export function EmbedGwadaFooter({ className }: { className?: string }) {
  const [brand, setBrand] = useState<EmbedBrandInfo>({
    appName: "gwada",
    logoUrl: EMBED_BRAND_FOOTER_LOGO_PATH,
  });
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/platform/app-branding");
        if (!res.ok) return;
        const data = (await res.json()) as {
          appName?: string;
          logoUrl?: string | null;
        };
        if (cancelled) return;
        setBrand({
          appName: data.appName?.trim() || "gwada",
          logoUrl: data.logoUrl?.trim() || EMBED_BRAND_FOOTER_LOGO_PATH,
        });
        setLogoFailed(false);
      } catch {
        /* Favicon-Fallback bleibt */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const href =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://gwada.app";

  const showLogo = brand.logoUrl && !logoFailed;

  return (
    <footer
      className={cn(
        "flex shrink-0 justify-center px-4 pt-2 pb-3",
        className,
      )}
      aria-label={brand.appName}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-60 transition-opacity hover:opacity-85"
      >
        {showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl!}
            alt={brand.appName}
            decoding="async"
            className="h-5 w-auto max-w-[5.5rem] object-contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="text-[11px] font-medium tracking-tight text-muted-foreground">
            {brand.appName}
          </span>
        )}
      </a>
    </footer>
  );
}
