/** Free: 1 Login. Basic: 3. Pro: unbegrenzt. */
export const FREE_REGISTERED_USER_LIMIT = 1;
export const BASIC_REGISTERED_USER_LIMIT = 3;

export const REGISTERED_USER_LIMIT_ERROR = "user_limit";

export const REGISTERED_USER_LIMIT_MESSAGE =
  "Free erlaubt 1 App-Login, Basic maximal 3. Für unbegrenzt: Pro — oder zuerst einen bestehenden Zugang entziehen.";

export const REGISTERED_USER_LIMIT_ACCEPT_MESSAGE =
  "Dieses Restaurant hat die Nutzergrenze erreicht (Free: 1 Login, Basic: 3). Bitte upgraden oder ein bestehendes Konto entfernen.";

export function registeredUserLimitToastMessage(cap?: number | null): string {
  if (cap === 1) {
    return "Free erlaubt nur 1 App-Login. Weitere Einladungen mit Basic (3 Logins) oder Pro (unbegrenzt).";
  }
  if (cap === 3) {
    return "Basic erlaubt maximal 3 App-Logins. Für unbegrenzt: Pro — oder zuerst einen bestehenden Zugang entziehen.";
  }
  return REGISTERED_USER_LIMIT_MESSAGE;
}

type SeatCapInput = {
  planId: "free" | "basic" | "pro";
  source: string;
  status: string;
  pastDueGraceExpired: boolean;
};

function capForPlan(planId: SeatCapInput["planId"]): number | null {
  if (planId === "pro") return null;
  if (planId === "basic") return BASIC_REGISTERED_USER_LIMIT;
  return FREE_REGISTERED_USER_LIMIT;
}

/** `null` = unbegrenzt (Pro, Legacy, Complimentary). */
export function registeredUserSeatCap(
  entitlements: SeatCapInput | null | undefined,
): number | null {
  if (!entitlements) return null;
  if (
    entitlements.source === "legacy" ||
    entitlements.source === "complimentary" ||
    entitlements.status === "legacy"
  ) {
    return null;
  }
  const planId = entitlements.pastDueGraceExpired
    ? "free"
    : entitlements.planId;
  if (
    planId === "pro" &&
    entitlements.status !== "canceled" &&
    entitlements.status !== "incomplete"
  ) {
    return null;
  }
  return capForPlan(planId === "pro" ? "free" : planId);
}

export function isRegisteredUserLimitError(
  error: string | null | undefined,
): boolean {
  return Boolean(error && error.includes(REGISTERED_USER_LIMIT_ERROR));
}
