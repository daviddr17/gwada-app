"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";

/**
 * Zusatzschicht: Proxy + Server-Layout leiten Nicht-Superadmins bereits um.
 * Verhindert kurz sichtbare Client-Inhalte bei Client-Navigation.
 */
export function SuperadminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isSuperadmin, loading } = useIsSuperadmin();

  useEffect(() => {
    if (!loading && !isSuperadmin) {
      router.replace("/dashboard");
    }
  }, [loading, isSuperadmin, router]);

  if (loading || !isSuperadmin) {
    return (
      <div
        className="min-h-[40vh]"
        aria-busy={loading || undefined}
        aria-hidden={!loading && !isSuperadmin ? true : undefined}
      />
    );
  }

  return children;
}
