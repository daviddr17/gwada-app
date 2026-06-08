import { posJson } from "@/lib/pos/pos-responses";

export const dynamic = "force-dynamic";

/** Mollie webhook — Phase 2. Acknowledge to avoid retry storms. */
export async function POST(_request: Request) {
  return posJson({ ok: true, processed: false, reason: "mollie_not_implemented" });
}
