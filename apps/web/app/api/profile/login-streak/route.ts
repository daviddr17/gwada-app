import { NextResponse } from "next/server";
import {
  buildLoginStreakSummary,
  type LoginStreakSummary,
} from "@/lib/profile/login-streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 91;

function berlinTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + delta));
  return dt.toISOString().slice(0, 10);
}

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const todayBerlin = berlinTodayYmd();
  const fromYmd = addDaysYmd(todayBerlin, -(LOOKBACK_DAYS - 1));

  const { data, error } = await sb
    .from("user_login_days")
    .select("day")
    .eq("profile_id", user.id)
    .gte("day", fromYmd)
    .order("day", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const days = (data ?? []).map((row) =>
    String((row as { day: string }).day).slice(0, 10),
  );
  const summary: LoginStreakSummary = buildLoginStreakSummary(
    days,
    todayBerlin,
    LOOKBACK_DAYS,
  );

  return NextResponse.json({ data: summary });
}
