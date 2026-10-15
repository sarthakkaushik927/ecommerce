import { z } from "zod";

const paise = z.number().int().min(0);

export const updateSettingsSchema = z
  .object({
    storeName: z.string().trim().min(1).max(80),
    supportEmail: z.email(),
    supportPhone: z.string().trim().max(20),
    adminEmail: z.union([z.email(), z.literal("")]),
    adminWhatsapp: z.string().trim().max(20),
    deliveryFee: paise,
    freeDeliveryThreshold: paise,
    coinEarnPer100: z.number().int().min(0).max(100),
    coinMaxRedeemPercent: z.number().int().min(0).max(100),
    returnWindowDays: z.number().int().min(0).max(60),
    codEnabled: z.boolean(),
    upiOnDeliveryEnabled: z.boolean(),
    referralEnabled: z.boolean(),
    referralReferrerCoins: z.number().int().min(0),
    referralRefereeCoins: z.number().int().min(0),
  })
  .partial();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
