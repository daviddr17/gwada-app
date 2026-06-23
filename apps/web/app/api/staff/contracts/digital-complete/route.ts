import { handleStaffContractDigitalCompleteRequest } from "@/lib/staff/staff-contract-digital-complete-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleStaffContractDigitalCompleteRequest(req);
}
