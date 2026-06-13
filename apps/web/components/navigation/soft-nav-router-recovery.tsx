"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const RECOVERY_COOLDOWN_MS = 4000;

/**
 * Next.js Router-Overlay „This page couldn't load“ nach fehlgeschlagenem RSC-Flight:
 * einmalig router.refresh() (greift solange die App-Provider noch gemountet sind).
 */
export function SoftNavRouterRecovery() {
  const router = useRouter();
  const lastRecoveryAtRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      if (!document.body.innerText.includes("couldn't load")) return;
      const now = Date.now();
      if (now - lastRecoveryAtRef.current < RECOVERY_COOLDOWN_MS) return;
      lastRecoveryAtRef.current = now;
      router.refresh();
    };

    const id = window.setInterval(tick, 600);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
