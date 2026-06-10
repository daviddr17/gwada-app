import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  deleteAccountingDocumentStatus,
  listAccountingDocumentStatuses,
  reorderAccountingDocumentStatuses,
  upsertAccountingDocumentStatus,
} from "@/lib/accounting/accounting-statuses-server";
import type { AccountingDocumentKind } from "@/lib/accounting/default-catalog";

export const dynamic = "force-dynamic";

function parseDocumentKind(raw: string | null): AccountingDocumentKind | null {
  if (raw === "invoice" || raw === "quotation" || raw === "voucher") {
    return raw;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const kind = parseDocumentKind(url.searchParams.get("kind"));
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!kind) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const statuses = await listAccountingDocumentStatuses(
    auth.sb,
    auth.restaurantId,
    kind,
    { includeArchived },
  );
  return NextResponse.json({ statuses });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    document_kind: AccountingDocumentKind;
    label: string;
    color_hex?: string;
    sort_order?: number;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const kind = parseDocumentKind(body.document_kind);
  if (!kind || !body.label?.trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { row, error } = await upsertAccountingDocumentStatus(
    auth.sb,
    auth.restaurantId,
    kind,
    { label: body.label, sort_order: body.sort_order },
  );
  if (error || !row) {
    return NextResponse.json({ error: error ?? "create_failed" }, { status: 400 });
  }
  return NextResponse.json({ status: row });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    document_kind: AccountingDocumentKind;
    reorder?: string[];
    id?: string;
    label?: string;
    color_hex?: string;
    archived?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const kind = parseDocumentKind(body.document_kind);
  if (!kind) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (body.reorder?.length) {
    const { error } = await reorderAccountingDocumentStatuses(
      auth.sb,
      auth.restaurantId,
      kind,
      body.reorder,
    );
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.id || !body.label?.trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { row, error } = await upsertAccountingDocumentStatus(
    auth.sb,
    auth.restaurantId,
    kind,
    {
      id: body.id,
      label: body.label,
      color_hex: body.color_hex,
      archived: body.archived,
    },
  );
  if (error || !row) {
    return NextResponse.json({ error: error ?? "update_failed" }, { status: 400 });
  }
  return NextResponse.json({ status: row });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const id = url.searchParams.get("id");
  const kind = parseDocumentKind(url.searchParams.get("kind"));
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!id || !kind) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { error } = await deleteAccountingDocumentStatus(
    auth.sb,
    auth.restaurantId,
    kind,
    id,
  );
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
