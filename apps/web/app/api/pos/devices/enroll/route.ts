import {
  claimPosDeviceEnrollment,
} from "@/lib/pos/pos-capabilities-devices-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Öffentlich: Einrichtungs-Code (8 Zeichen) → Device-Token + Restaurant.
 * Kein User-Bearer — Code ist das Geheimnis (wie Display-Pairing).
 */
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) return posError("server_misconfigured", 503);

  let body: {
    code?: string;
    installationId?: string;
    preferredName?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return posError("invalid_request", 400);
  }

  const result = await claimPosDeviceEnrollment({
    admin,
    code: body.code ?? "",
    installationId: body.installationId ?? "",
    preferredName: body.preferredName,
  });

  if (!result.ok) return posError(result.error, result.status);
  return posJson({ ok: true, ...result.claim });
}
