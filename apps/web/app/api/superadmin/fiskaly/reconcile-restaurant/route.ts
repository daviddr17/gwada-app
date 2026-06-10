import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  linkFiskalyExistingClient,
  previewFiskalyReconcile,
} from "@/lib/pos/fiskaly-reconcile";
import {
  germanFiskalyProvisionError,
  fiskalyProvisionOutcomeLabel,
} from "@/lib/pos/fiskaly-error-messages";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    restaurantId?: string;
    tssId?: string;
    clientId?: string;
    clientSerial?: string;
    confirm?: boolean;
  };

  const restaurantId = body.restaurantId?.trim();
  if (!restaurantId) {
    return Response.json({ error: "restaurant_id_required" }, { status: 400 });
  }

  if (!body.confirm) {
    const preview = await previewFiskalyReconcile(restaurantId);
    if (!preview.ok) {
      return Response.json(
        { error: preview.error, errorLabel: germanFiskalyProvisionError(preview.error) },
        { status: 400 },
      );
    }
    return Response.json(preview);
  }

  const tssId = body.tssId?.trim();
  const clientId = body.clientId?.trim();
  const clientSerial = body.clientSerial?.trim();

  if (!tssId || !clientId || !clientSerial) {
    const preview = await previewFiskalyReconcile(restaurantId);
    if (!preview.ok || !preview.match) {
      return Response.json(
        { error: "reconcile_match_required" },
        { status: 400 },
      );
    }
    const linked = await linkFiskalyExistingClient({
      restaurantId,
      tssId: preview.match.tssId,
      clientId: preview.match.clientId,
      clientSerial: preview.match.clientSerial,
    });
    if (!linked.ok) {
      return Response.json(
        {
          error: linked.error,
          errorLabel: germanFiskalyProvisionError(linked.error),
        },
        { status: 502 },
      );
    }
    return Response.json({
      ok: true,
      restaurantId,
      outcome: linked.outcome,
      outcomeLabel: fiskalyProvisionOutcomeLabel(linked.outcome),
    });
  }

  const linked = await linkFiskalyExistingClient({
    restaurantId,
    tssId,
    clientId,
    clientSerial,
  });

  if (!linked.ok) {
    return Response.json(
      {
        error: linked.error,
        errorLabel: germanFiskalyProvisionError(linked.error),
      },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    restaurantId,
    outcome: linked.outcome,
    outcomeLabel: fiskalyProvisionOutcomeLabel(linked.outcome),
  });
}
