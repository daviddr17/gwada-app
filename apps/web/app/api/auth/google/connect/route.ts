import { type NextRequest } from "next/server";
import { handleGoogleOAuthConnect } from "@/lib/auth/google-oauth-connect";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleGoogleOAuthConnect(req);
}
