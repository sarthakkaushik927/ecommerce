import type { Settings } from "../../generated/prisma/client.js";
import { prisma, type Db } from "../../lib/prisma.js";
import type { UpdateSettingsInput } from "./settings.schema.js";

const SETTINGS_ID = 1;

export async function getSettings(db: Db = prisma): Promise<Settings> {
  return db.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

/** Settings safe to expose to shoppers. */
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    storeName: s.storeName,
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    deliveryFee: s.deliveryFee,
    freeDeliveryThreshold: s.freeDeliveryThreshold,
    coinEarnPer100: s.coinEarnPer100,
    coinMaxRedeemPercent: s.coinMaxRedeemPercent,
    returnWindowDays: s.returnWindowDays,
    codEnabled: s.codEnabled,
    upiOnDeliveryEnabled: s.upiOnDeliveryEnabled,
    referralEnabled: s.referralEnabled,
    referralReferrerCoins: s.referralReferrerCoins,
    referralRefereeCoins: s.referralRefereeCoins,
  };
}

export async function updateSettings(input: UpdateSettingsInput) {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: input,
    create: { id: SETTINGS_ID, ...input },
  });
}
