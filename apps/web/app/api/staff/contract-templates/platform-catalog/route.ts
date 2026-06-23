import { handlePlatformContractCatalogRequest } from "@/lib/staff/staff-contract-platform-import-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handlePlatformContractCatalogRequest(req);
}
