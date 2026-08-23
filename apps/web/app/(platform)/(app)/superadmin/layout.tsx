import { assertSuperadminPageAccess } from "@/lib/superadmin/assert-superadmin-page";

/** Server-Assert; UI = SuperadminSPA via AppZoneRouter. */
export default async function SuperadminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await assertSuperadminPageAccess();
  return children;
}
