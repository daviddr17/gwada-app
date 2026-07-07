import { handleDeleteStaffRequest } from "@/lib/staff/staff-delete-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleDeleteStaffRequest(req);
}
