import { describe, expect, it } from "vitest";
import { type Db } from "../../src/lib/prisma.js";
import { generateCandidateReferralCode, normalizeReferralCode } from "../../src/lib/referral-code.js";
import { validateReferralAttribution } from "../../src/modules/referrals/referrals.service.js";

describe("referral code generation and normalization", () => {
  it("generates uppercase alphanumeric codes prefixed with HAAT and length 8", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateCandidateReferralCode();
      expect(code).toMatch(/^HAAT[2-9A-HJ-NP-Z]{4}$/);
      expect(code.length).toBe(8);
    }
  });

  it("normalizes referral code to uppercase and trimmed", () => {
    expect(normalizeReferralCode("  haat4x8k ")).toBe("HAAT4X8K");
    expect(normalizeReferralCode("")).toBeUndefined();
    expect(normalizeReferralCode(null)).toBeUndefined();
    expect(normalizeReferralCode(undefined)).toBeUndefined();
  });
});

describe("referral attribution business rules", () => {
  const mockSettings = {
    id: 1,
    storeName: "Haat",
    supportEmail: "support@haat.local",
    supportPhone: "",
    adminEmail: "",
    adminWhatsapp: "",
    deliveryFee: 4000,
    freeDeliveryThreshold: 49900,
    coinEarnPer100: 2,
    coinMaxRedeemPercent: 20,
    returnWindowDays: 7,
    codEnabled: true,
    upiOnDeliveryEnabled: true,
    referralEnabled: true,
    referralReferrerCoins: 50,
    referralRefereeCoins: 25,
    updatedAt: new Date(),
  };

  const referrerUser = {
    id: "user-referrer-1",
    name: "Alice",
    email: "alice@example.com",
    phone: "+919876543210",
    passwordHash: "hash",
    role: "CUSTOMER" as const,
    isBlocked: false,
    avatarUrl: null,
    coinBalance: 0,
    referralCode: "HAAT4X8K",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createMockDb(overrides: {
    referralEnabled?: boolean;
    referrerUser?: typeof referrerUser | null;
    referrerReferral?: { referrerId: string; referrer: { id: string; email: string; phone: string | null } } | null;
  } = {}) {
    return {
      settings: {
        upsert: async () => ({ ...mockSettings, referralEnabled: overrides.referralEnabled ?? true }),
      },
      user: {
        findUnique: async ({ where }: { where: { referralCode?: string; id?: string } }) => {
          if (where.referralCode === "HAAT4X8K") {
            return overrides.referrerUser !== undefined ? overrides.referrerUser : referrerUser;
          }
          return null;
        },
      },
      referral: {
        findUnique: async () => overrides.referrerReferral ?? null,
      },
    } as unknown as Db;
  }

  it("rejects attribution when referral program is inactive", async () => {
    const db = createMockDb({ referralEnabled: false });
    await expect(
      validateReferralAttribution(db, {
        referralCode: "HAAT4X8K",
        refereeEmail: "bob@example.com",
        refereePhone: "+919123456789",
      }),
    ).rejects.toThrow("Referral program is currently not active");
  });

  it("rejects unknown referral codes", async () => {
    const db = createMockDb({ referrerUser: null });
    await expect(
      validateReferralAttribution(db, {
        referralCode: "HAATINVALID",
        refereeEmail: "bob@example.com",
        refereePhone: "+919123456789",
      }),
    ).rejects.toThrow("Invalid referral code");
  });

  it("rejects self-referral by same user id", async () => {
    const db = createMockDb();
    await expect(
      validateReferralAttribution(db, {
        referralCode: "HAAT4X8K",
        refereeEmail: "other@example.com",
        refereePhone: "+919999999999",
        refereeId: "user-referrer-1",
      }),
    ).rejects.toThrow("Self-referrals are not allowed");
  });

  it("rejects self-referral by same email (case-insensitive)", async () => {
    const db = createMockDb();
    await expect(
      validateReferralAttribution(db, {
        referralCode: "HAAT4X8K",
        refereeEmail: "ALICE@EXAMPLE.COM",
        refereePhone: "+919999999999",
      }),
    ).rejects.toThrow("Self-referrals are not allowed");
  });

  it("rejects self-referral by same phone number", async () => {
    const db = createMockDb();
    await expect(
      validateReferralAttribution(db, {
        referralCode: "HAAT4X8K",
        refereeEmail: "bob@example.com",
        refereePhone: "+919876543210",
      }),
    ).rejects.toThrow("Self-referrals are not allowed");
  });

  it("rejects cyclic referral when referrer was referred by referee", async () => {
    const db = createMockDb({
      referrerReferral: {
        referrerId: "user-bob-referee",
        referrer: { id: "user-bob-referee", email: "bob@example.com", phone: "+919123456789" },
      },
    });

    await expect(
      validateReferralAttribution(db, {
        referralCode: "HAAT4X8K",
        refereeEmail: "bob@example.com",
        refereePhone: "+919123456789",
        refereeId: "user-bob-referee",
      }),
    ).rejects.toThrow("Cyclic referrals are not allowed");
  });

  it("accepts valid referral attribution from a distinct user", async () => {
    const db = createMockDb();
    const result = await validateReferralAttribution(db, {
      referralCode: "haat4x8k",
      refereeEmail: "bob@example.com",
      refereePhone: "+919123456789",
      refereeId: "user-bob-2",
    });

    expect(result.referrer.id).toBe("user-referrer-1");
    expect(result.settings.referralReferrerCoins).toBe(50);
    expect(result.settings.referralRefereeCoins).toBe(25);
  });
});

describe("referral creation integrity", () => {
  it("rejects duplicate referral for the same referee (max 1 referrer)", async () => {
    const mockDb = {
      referral: {
        findUnique: async () => ({ id: "existing-ref-1", refereeId: "bob" }),
        create: async () => ({ id: "new-ref-2" }),
      },
    } as unknown as Db;

    const { createReferralRecord } = await import("../../src/modules/referrals/referrals.service.js");
    await expect(
      createReferralRecord(mockDb, {
        referrerId: "alice",
        refereeId: "bob",
        referrerCoins: 50,
        refereeCoins: 25,
      }),
    ).rejects.toThrow("Referral code has already been applied");
  });

  it("creates a pending referral with configured coins", async () => {
    const createdPayload: { status?: string; referrerCoins?: number; refereeCoins?: number } = {};
    const mockDb = {
      referral: {
        findUnique: async () => null,
        create: async ({ data }: { data: typeof createdPayload }) => {
          Object.assign(createdPayload, data);
          return { id: "ref-new", ...data };
        },
      },
    } as unknown as Db;

    const { createReferralRecord } = await import("../../src/modules/referrals/referrals.service.js");
    const result = await createReferralRecord(mockDb, {
      referrerId: "alice",
      refereeId: "bob",
      referrerCoins: 50,
      refereeCoins: 25,
    });

    expect(result.id).toBe("ref-new");
    expect(createdPayload.status).toBe("PENDING");
    expect(createdPayload.referrerCoins).toBe(50);
    expect(createdPayload.refereeCoins).toBe(25);
  });
});

