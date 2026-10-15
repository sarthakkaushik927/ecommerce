import { AppError } from "../../lib/errors.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { ensureUniqueReferralCode, normalizeReferralCode } from "../../lib/referral-code.js";
import { getSettings } from "../settings/settings.service.js";

type ValidateOptions = {
  referralCode: string;
  refereeEmail: string;
  refereePhone?: string | null;
  refereeId?: string;
};

export async function validateReferralAttribution(db: Db, options: ValidateOptions) {
  const code = normalizeReferralCode(options.referralCode);
  if (!code) throw AppError.badRequest("Enter a valid referral code");

  const settings = await getSettings(db);
  if (!settings.referralEnabled) {
    throw AppError.badRequest("Referral program is currently not active");
  }

  const referrer = await db.user.findUnique({ where: { referralCode: code } });
  if (!referrer) {
    throw AppError.badRequest("Invalid referral code");
  }

  // Self-referral rejection (same user ID, email, or phone)
  const isSameUser = options.refereeId && referrer.id === options.refereeId;
  const isSameEmail = referrer.email.toLowerCase() === options.refereeEmail.toLowerCase();
  const isSamePhone = Boolean(referrer.phone && options.refereePhone && referrer.phone === options.refereePhone);

  if (isSameUser || isSameEmail || isSamePhone) {
    throw AppError.badRequest("Self-referrals are not allowed");
  }

  // Cyclic referral rejection (User A refers B, B refers A)
  const referrerReferral = await db.referral.findUnique({
    where: { refereeId: referrer.id },
    include: { referrer: { select: { id: true, email: true, phone: true } } },
  });

  if (referrerReferral) {
    const isCyclicId = Boolean(options.refereeId && referrerReferral.referrerId === options.refereeId);
    const isCyclicEmail = referrerReferral.referrer.email.toLowerCase() === options.refereeEmail.toLowerCase();
    const isCyclicPhone = Boolean(
      referrerReferral.referrer.phone && options.refereePhone && referrerReferral.referrer.phone === options.refereePhone,
    );

    if (isCyclicId || isCyclicEmail || isCyclicPhone) {
      throw AppError.badRequest("Cyclic referrals are not allowed");
    }
  }

  return { referrer, settings };
}

export async function createReferralRecord(
  db: Db,
  input: {
    referrerId: string;
    refereeId: string;
    referrerCoins: number;
    refereeCoins: number;
  },
) {
  const existing = await db.referral.findUnique({ where: { refereeId: input.refereeId } });
  if (existing) {
    throw AppError.badRequest("Referral code has already been applied");
  }

  return db.referral.create({
    data: {
      referrerId: input.referrerId,
      refereeId: input.refereeId,
      referrerCoins: input.referrerCoins,
      refereeCoins: input.refereeCoins,
      status: "PENDING",
    },
  });
}

export async function applyReferralCodeForUser(userId: string, rawCode: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("User");

    const priorOrders = await tx.order.count({ where: { userId } });
    if (priorOrders > 0) {
      throw AppError.badRequest("Referral code can only be applied before your first order");
    }

    const { referrer, settings } = await validateReferralAttribution(tx, {
      referralCode: rawCode,
      refereeEmail: user.email,
      refereePhone: user.phone,
      refereeId: user.id,
    });

    return createReferralRecord(tx, {
      referrerId: referrer.id,
      refereeId: user.id,
      referrerCoins: settings.referralReferrerCoins,
      refereeCoins: settings.referralRefereeCoins,
    });
  });
}

export async function getReferralSummary(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, referralCode: true } });
  if (!user) throw AppError.notFound("User");

  let referralCode = user.referralCode;
  if (!referralCode) {
    referralCode = await ensureUniqueReferralCode(prisma);
    await prisma.user.update({ where: { id: userId }, data: { referralCode } });
  }

  const settings = await getSettings();
  const [completedCount, pendingCount, earnedSum] = await Promise.all([
    prisma.referral.count({ where: { referrerId: userId, status: "COMPLETED" } }),
    prisma.referral.count({ where: { referrerId: userId, status: "PENDING" } }),
    prisma.referral.aggregate({
      where: { referrerId: userId, status: "COMPLETED" },
      _sum: { referrerCoins: true },
    }),
  ]);

  return {
    referralCode,
    completedCount,
    pendingCount,
    totalCoinsEarned: earnedSum._sum.referrerCoins ?? 0,
    referrerBonus: settings.referralReferrerCoins,
    refereeBonus: settings.referralRefereeCoins,
    enabled: settings.referralEnabled,
  };
}
