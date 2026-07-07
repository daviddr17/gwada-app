import { SupabaseDatabaseGate } from "@/components/providers/supabase-database-gate";
import { LoginShellProviders } from "./login-shell-providers";

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <LoginShellProviders>
      <SupabaseDatabaseGate>{children}</SupabaseDatabaseGate>
    </LoginShellProviders>
  );
}
