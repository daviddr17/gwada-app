import { AppMain } from "@/components/layout/app-main";
import { SuperadminGuard } from "@/components/superadmin/superadmin-guard";
import { assertSuperadminPageAccess } from "@/lib/superadmin/assert-superadmin-page";

export default async function SuperadminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await assertSuperadminPageAccess();

  return (
    <SuperadminGuard>
      <AppMain>{children}</AppMain>
    </SuperadminGuard>
  );
}
