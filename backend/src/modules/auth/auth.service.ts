import { env } from "../../config/env.js";
import type { User } from "../../generated/prisma/client.js";
import { randomDigits, randomToken, sha256 } from "../../lib/crypto.js";
import { AppError } from "../../lib/errors.js";
import { signAccessToken } from "../../lib/jwt.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { toE164 } from "../../lib/phone.js";
import { prisma } from "../../lib/prisma.js";
import { ensureUniqueReferralCode } from "../../lib/referral-code.js";
import { inBackground, sendPasswordResetOtp } from "../../services/notify/index.js";
import { createReferralRecord, validateReferralAttribution } from "../referrals/referrals.service.js";
import { toPublicUser } from "../users/user.presenter.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Parallel requests from one client (e.g. route prefetches) race to rotate the same token; a reuse this soon after rotation is that race, not theft. */
const ROTATION_GRACE_MS = 10_000;

async function issueSession(user: User, userAgent?: string) {
  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: userAgent?.slice(0, 255),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
    },
  });
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken,
  };
}

export async function register(input: RegisterInput, userAgent?: string) {
  const phone = toE164(input.phone);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { phone }] },
    select: { email: true },
  });
  if (existing) {
    throw AppError.conflict(
      existing.email === input.email ? "An account with this email already exists" : "This phone number is already registered",
    );
  }

  const attribution = input.referralCode
    ? await validateReferralAttribution(prisma, {
        referralCode: input.referralCode,
        refereeEmail: input.email,
        refereePhone: phone,
      })
    : null;

  const referralCode = await ensureUniqueReferralCode(prisma);
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone,
        passwordHash,
        referralCode,
      },
    });

    if (attribution) {
      await createReferralRecord(tx, {
        referrerId: attribution.referrer.id,
        refereeId: newUser.id,
        referrerCoins: attribution.settings.referralReferrerCoins,
        refereeCoins: attribution.settings.referralRefereeCoins,
      });
    }

    return newUser;
  });

  return issueSession(user, userAgent);
}

export async function login({ identifier, password }: LoginInput, userAgent?: string) {
  const isEmail = identifier.includes("@");
  const user = await prisma.user.findUnique({
    where: isEmail ? { email: identifier.toLowerCase() } : { phone: toE164(identifier) },
  });
  // Same message for unknown user and bad password to avoid account enumeration.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw AppError.unauthorized("Invalid credentials");
  }
  if (user.isBlocked) throw AppError.forbidden("Your account has been blocked. Contact support.");
  return issueSession(user, userAgent);
}

/**
 * Rotates the refresh token. Re-use of a revoked token revokes every session of that user,
 * except a re-use of a just-rotated token, which gets a fresh session of its own.
 */
export async function refresh(refreshToken: string, userAgent?: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshToken) },
    include: { user: true },
  });
  if (!stored) throw AppError.unauthorized("Invalid session");

  if (stored.revokedAt) {
    const racedRotation = stored.rotatedAt && Date.now() - stored.rotatedAt.getTime() < ROTATION_GRACE_MS;
    if (racedRotation && !stored.user.isBlocked && stored.expiresAt > new Date()) {
      return issueSession(stored.user, userAgent);
    }
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized("Session expired, please log in again");
  }
  if (stored.expiresAt < new Date()) throw AppError.unauthorized("Session expired, please log in again");
  if (stored.user.isBlocked) throw AppError.forbidden("Your account has been blocked. Contact support.");

  const now = new Date();
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: now, rotatedAt: now } });
  return issueSession(stored.user, userAgent);
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: string) {
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized();
  if (!user.referralCode) {
    const referralCode = await ensureUniqueReferralCode(prisma);
    user = await prisma.user.update({ where: { id: userId }, data: { referralCode } });
  }
  return toPublicUser(user);
}

/** Always resolves, so callers cannot probe which emails are registered. */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isBlocked) return;

  const otp = randomDigits(6);
  await prisma.passwordReset.create({
    data: { userId: user.id, otpHash: sha256(otp), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  inBackground(() => sendPasswordResetOtp(user, otp));
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  const invalid = AppError.badRequest("Invalid or expired code");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw invalid;

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!reset || reset.attempts >= OTP_MAX_ATTEMPTS) throw invalid;

  if (reset.otpHash !== sha256(otp)) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    throw invalid;
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw AppError.badRequest("Current password is incorrect");
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}
