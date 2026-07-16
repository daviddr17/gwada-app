import {
  deletePosPrinter,
  listPosPrinters,
  upsertPosPrinter,
} from "@/lib/pos/pos-printers-server";
import {
  isPosPrinterConnectionType,
  type PosPrinterConnectionType,
} from "@gwada/pos-domain";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const printers = await listPosPrinters(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ printers });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    id?: string;
    name?: string;
    connectionType?: string;
    connectionConfig?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    isActive?: boolean;
    delete?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  if (body.delete && body.id) {
    const ok = await deletePosPrinter(
      authResult.auth.supabase,
      authResult.auth.restaurantId,
      body.id,
    );
    return ok ? posJson({ ok: true }) : posError("delete_failed", 500);
  }

  const name = body.name?.trim() ?? "";
  if (!name) return posError("invalid_name", 400);

  const connectionType: PosPrinterConnectionType = isPosPrinterConnectionType(
    body.connectionType,
  )
    ? body.connectionType
    : "virtual";

  const printer = await upsertPosPrinter({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    id: body.id,
    name,
    connectionType,
    connectionConfig: body.connectionConfig,
    settings: body.settings,
    isActive: body.isActive,
  });

  if (!printer) return posError("save_failed", 500);
  return posJson({ printer });
}
