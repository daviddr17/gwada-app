import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { dispatchGithubLiveAppDeploy } from "@/lib/superadmin/github-deploy-api-server";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await dispatchGithubLiveAppDeploy();
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 409 });
  }

  return Response.json({ ok: true });
}
