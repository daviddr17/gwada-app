import { NextResponse } from "next/server";
import { buildDisplayContext } from "@/lib/display/display-auth-server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const context = await buildDisplayContext(cookieStore);
  return NextResponse.json(context);
}
