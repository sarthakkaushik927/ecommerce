import { z } from "zod";

// ─── Public ───────────────────────────────────────────────────────────────

export const BranchByDistanceQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type BranchByDistanceQuery = z.infer<typeof BranchByDistanceQuery>;

export const NearestBranchQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type NearestBranchQuery = z.infer<typeof NearestBranchQuery>;

export const BranchIdParam = z.object({
  id: z.string().min(1),
});

// ─── Admin ───────────────────────────────────────────────────────────────

export const CreateBranchBody = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  deliveryRadiusKm: z.number().positive().max(100).default(5),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  offlineMessage: z.string().max(200).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isOnline: z.boolean().default(true),
});
export type CreateBranchBody = z.infer<typeof CreateBranchBody>;

export const UpdateBranchBody = CreateBranchBody.partial();
export type UpdateBranchBody = z.infer<typeof UpdateBranchBody>;

export const SetOnlineBody = z.object({
  isOnline: z.boolean(),
  reason: z.string().max(500).optional(),
});
export type SetOnlineBody = z.infer<typeof SetOnlineBody>;

export const AssignRiderBody = z.object({
  riderId: z.string().min(1),
});
export type AssignRiderBody = z.infer<typeof AssignRiderBody>;

export const RiderIdParam = z.object({
  riderId: z.string().min(1),
});
