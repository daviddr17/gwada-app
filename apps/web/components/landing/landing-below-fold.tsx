"use client";

import { LandingIntegrationsScrollStory } from "@/components/landing/landing-integrations-scroll-story";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingScrollStory } from "@/components/landing/landing-scroll-story";

/** Unterhalb des Heroes — eigener Chunk, erst nach Idle/Viewport. */
export function LandingBelowFold() {
  return (
    <>
      <LandingScrollStory />
      <LandingIntegrationsScrollStory />
      <LandingPricing />
    </>
  );
}
