import "server-only";

export type EmailOAuthPurpose = "shared" | "personal";

export type EmailOAuthState = {
  restaurantId: string;
  purpose: EmailOAuthPurpose;
  /** Required when purpose = personal. */
  userId?: string;
};

export function encodeEmailOAuthState(payload: EmailOAuthState): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeEmailOAuthState(state: string): EmailOAuthState | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as {
      restaurantId?: string;
      purpose?: string;
      userId?: string;
    };
    if (!parsed.restaurantId || typeof parsed.restaurantId !== "string") {
      return null;
    }
    const purpose: EmailOAuthPurpose =
      parsed.purpose === "personal" ? "personal" : "shared";
    if (
      purpose === "personal" &&
      (!parsed.userId || typeof parsed.userId !== "string")
    ) {
      return null;
    }
    return {
      restaurantId: parsed.restaurantId,
      purpose,
      userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
    };
  } catch {
    return null;
  }
}
