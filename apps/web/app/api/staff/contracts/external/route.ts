import { handleStaffContractExternalSaveRequest } from "@/lib/staff/staff-contract-external-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleStaffContractExternalSaveRequest(req);
}
