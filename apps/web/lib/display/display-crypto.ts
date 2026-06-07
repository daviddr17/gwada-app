import { createHash, randomBytes } from "crypto";

export function hashDisplayToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateDisplayToken(): string {
  return randomBytes(32).toString("hex");
}

export function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}
