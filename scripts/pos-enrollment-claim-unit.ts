/**
 * Unit-level smoke for enrollment code hashing (no DB).
 * Run: pnpm exec tsx scripts/pos-enrollment-claim-unit.ts
 */
import { createHash, randomBytes } from "node:crypto";

function hashEnrollmentCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

function generateEnrollmentCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

const code = generateEnrollmentCode();
if (!/^[A-Z0-9]{8}$/.test(code)) {
  console.error("FAIL: bad code shape", code);
  process.exit(1);
}
const h1 = hashEnrollmentCode(code);
const h2 = hashEnrollmentCode(code.toLowerCase());
if (h1 !== h2 || h1.length !== 64) {
  console.error("FAIL: hash mismatch", h1, h2);
  process.exit(1);
}
console.log("OK enrollment hash", code, h1.slice(0, 12) + "…");
