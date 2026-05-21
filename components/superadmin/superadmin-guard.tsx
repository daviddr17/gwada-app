"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";

export function SuperadminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isSuperadmin, loading } = useIsSuperadmin();

  useEffect(() => {
    if (!loading && !isSuperadmin) {
      router.replace("/dashboard");
    }
  }, [loading, isSuperadmin, router]);

  if (loading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center"
        aria-busy
        aria-label="Superadmin-Bereich wird geladen"
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperadmin) return null;

  return children;
}
