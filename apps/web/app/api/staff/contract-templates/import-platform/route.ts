import { handleImportPlatformContractTemplatesRequest } from "@/lib/staff/staff-contract-platform-import-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleImportPlatformContractTemplatesRequest(req);
}
