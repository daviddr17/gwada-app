import { handlePendingStaffContractsRequest } from "@/lib/staff/staff-contract-pending-server";

export async function GET(req: Request) {
  return handlePendingStaffContractsRequest(req);
}
