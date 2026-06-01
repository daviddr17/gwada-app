import { NextResponse } from "next/server";

/** Öffentliche Build-Metadaten — zum Verifizieren, welcher Commit live läuft. */
export async function GET() {
  return NextResponse.json({
    sha: process.env.GWADA_BUILD_SHA ?? "dev",
  });
}
