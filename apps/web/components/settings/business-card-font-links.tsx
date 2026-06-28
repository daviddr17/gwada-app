"use client";

import { BUSINESS_CARD_GOOGLE_FONTS_HREF } from "@/lib/restaurant/business-card-typography";

/** Lädt Serif-Schriften für Visitenkarten-Vorlagen (Classic, Elegant). */
export function BusinessCardFontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href={BUSINESS_CARD_GOOGLE_FONTS_HREF}
        rel="stylesheet"
        crossOrigin="anonymous"
      />
    </>
  );
}
