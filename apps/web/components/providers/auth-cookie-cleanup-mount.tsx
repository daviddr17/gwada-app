"use client";

import { useEffect, useRef } from "react";

const CLEANUP_SESSION_KEY = "gwada:auth-cookie-cleanup";

/**
 * Entfernt Legacy-OAuth-Cookies (HttpOnly) — auf Live häufige Ursache für
 * „Seite konnte nicht geladen werden“ bei Soft-Nav (RSC-Request + großer Cookie-Header).
 */
export function AuthCookieCleanupMount() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (sessionStorage.getItem(CLEANUP_SESSION_KEY) === "1") return;

    void fetch("/api/auth/cleanup-cookies", { credentials: "include" })
      .then(() => {
        sessionStorage.setItem(CLEANUP_SESSION_KEY, "1");
      })
      .catch(() => {});
  }, []);

  return null;
}
