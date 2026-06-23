import { handleStaffContractEmployeeSignRequest } from "@/lib/staff/staff-contract-employee-sign-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleStaffContractEmployeeSignRequest(req);
}
