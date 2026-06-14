import { SupabaseDatabaseGate } from "@/components/providers/supabase-database-gate";

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SupabaseDatabaseGate>{children}</SupabaseDatabaseGate>;
}
