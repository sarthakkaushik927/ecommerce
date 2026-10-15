import crypto from "node:crypto";
import type { Db } from "./prisma.js";

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomReferralSuffix(length = 4): string {
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    const byte = bytes[i] ?? 0;
    const char = CODE_CHARS[byte % CODE_CHARS.length] ?? "A";
    result += char;
  }
  return result;
}

export function generateCandidateReferralCode(): string {
  return `HAAT${randomReferralSuffix(4)}`;
}

export async function ensureUniqueReferralCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCandidateReferralCode();
    const existing = await db.user.findUnique({ where: { referralCode: candidate } });
    if (!existing) return candidate;
  }
  // Safe fallback if multiple collisions occur
  return `HAAT${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function normalizeReferralCode(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : undefined;
}
