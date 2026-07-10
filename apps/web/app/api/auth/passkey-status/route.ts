import { fetchPasskeyServerStatus } from "@/lib/auth/passkey-server-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await fetchPasskeyServerStatus();
  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
