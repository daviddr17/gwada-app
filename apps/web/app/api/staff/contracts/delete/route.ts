import { handleDeleteStaffContractRequest } from "@/lib/staff/staff-contract-delete-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleDeleteStaffContractRequest(req);
}
