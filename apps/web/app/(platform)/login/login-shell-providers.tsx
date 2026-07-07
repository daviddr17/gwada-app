"use client";

import { Toaster } from "@/components/ui/sonner";

/** Login-Zone: Toasts für sichtbare Fehler- und Erfolgsmeldungen. */
export function LoginShellProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Toaster />
      {children}
    </>
  );
}
