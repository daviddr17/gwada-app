"use client";

import { SupabaseDatabaseGate } from "@/components/providers/supabase-database-gate";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** App-Workspace: Toasts, Tooltips, DB-Gate — nur unter `(platform)/(app)`. */
export function WorkspaceShellProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Toaster />
      <SupabaseDatabaseGate>
        <TooltipProvider>{children}</TooltipProvider>
      </SupabaseDatabaseGate>
    </>
  );
}
