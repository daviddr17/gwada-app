import { handleStaffContractPrepareRequest } from "@/lib/staff/staff-contract-prepare-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleStaffContractPrepareRequest(req);
}
