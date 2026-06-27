import { NextResponse } from "next/server";
import { waitlistErrorMessage } from "@/lib/waitlist/waitlist-errors";
import { submitWaitlistSignup } from "@/lib/waitlist/waitlist-signup-server";

export const dynamic = "force-dynamic";

type WaitlistBody = {
  given_name?: string;
  family_name?: string;
  email?: string;
  note?: string | null;
};

export async function POST(request: Request) {
  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const result = await submitWaitlistSignup(
    {
      givenName: body.given_name ?? "",
      familyName: body.family_name ?? "",
      email: body.email ?? "",
      note: body.note ?? null,
    },
    origin,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: waitlistErrorMessage(result.error),
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    already_registered: result.alreadyRegistered,
  });
}
