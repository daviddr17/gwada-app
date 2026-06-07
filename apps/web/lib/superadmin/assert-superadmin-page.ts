import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSuperadminSession } from "@/lib/superadmin/superadmin-session";

/** Server Layout: kein Superadmin → kein HTML für `/superadmin/*`. */
export async function assertSuperadminPageAccess(): Promise<void> {
  const sb = await createSupabaseServerClient();
  const session = await getSuperadminSession(sb);

  if (session.status === "unauthenticated") {
    redirect("/login");
  }
  if (session.status === "forbidden") {
    redirect("/dashboard");
  }
}
