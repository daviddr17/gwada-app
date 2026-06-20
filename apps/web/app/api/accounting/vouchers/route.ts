import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  createAccountingVoucher,
  listAccountingVouchers,
} from "@/lib/accounting/accounting-vouchers-server";
import { parseAccountingListQueryFromUrl } from "@/lib/accounting/accounting-list-query";
import {
  resolveAccountingVoucherMime,
  validateAccountingVoucherFile,
} from "@/lib/accounting/validate-voucher-file";
import type { AccountingVoucherInput } from "@/lib/types/accounting";

export const dynamic = "force-dynamic";

function parseVoucherInput(raw: unknown): AccountingVoucherInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.voucherDate !== "string" || !o.voucherDate.trim()) return null;
  if (!Array.isArray(o.voucherItems)) return null;
  return raw as AccountingVoucherInput;
}

export async function GET(req: Request) {
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const listQuery = parseAccountingListQueryFromUrl(url);
  if (url.searchParams.get("source")) {
    listQuery.source = url.searchParams.get("source");
  }
  const result = await listAccountingVouchers(auth.sb, auth.restaurantId, listQuery);
  return NextResponse.json({
    vouchers: result.items,
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
  });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const restaurantIdRaw = form?.get("restaurantId");
    const restaurantId =
      typeof restaurantIdRaw === "string" ? restaurantIdRaw.trim() : "";
    const payloadRaw = form?.get("payload");
    const file = form?.get("file");

    const auth = await assertAccountingApi(restaurantId, "create");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let input: AccountingVoucherInput | null = null;
    if (typeof payloadRaw === "string") {
      try {
        input = parseVoucherInput(JSON.parse(payloadRaw));
      } catch {
        input = null;
      }
    }
    if (!input) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    let filePayload:
      | { buffer: Buffer; fileName: string; mimeType: string; sizeBytes: number }
      | undefined;

    if (file instanceof File && file.size > 0) {
      const fileError = validateAccountingVoucherFile(file);
      if (fileError) {
        return NextResponse.json({ error: fileError }, { status: 400 });
      }
      const mimeType = resolveAccountingVoucherMime(file);
      if (!mimeType) {
        return NextResponse.json({ error: "invalid_file" }, { status: 400 });
      }
      filePayload = {
        buffer: Buffer.from(await file.arrayBuffer()),
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
      };
    }

    const { row, error } = await createAccountingVoucher(auth.sb, {
      restaurantId: auth.restaurantId,
      userId: auth.userId,
      input,
      file: filePayload,
    });

    if (error || !row) {
      return NextResponse.json(
        { error: error ?? "create_failed" },
        { status: 400 },
      );
    }
    return NextResponse.json({ voucher: row });
  }

  const body = (await req.json()) as AccountingVoucherInput & {
    restaurantId?: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const input = parseVoucherInput(body);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { row, error } = await createAccountingVoucher(auth.sb, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    input,
  });

  if (error || !row) {
    return NextResponse.json(
      { error: error ?? "create_failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ voucher: row });
}
