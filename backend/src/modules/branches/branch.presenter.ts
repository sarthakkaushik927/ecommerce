import type { Branch } from "../../generated/prisma/client.js";

export type BranchWithDistance = Branch & {
  distanceKm: number;
  isWithinRadius: boolean;
};

export function presentBranch(branch: Branch) {
  return {
    id: branch.id,
    name: branch.name,
    slug: branch.slug,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    pincode: branch.pincode,
    lat: branch.lat,
    lng: branch.lng,
    deliveryRadiusKm: branch.deliveryRadiusKm,
    phone: branch.phone,
    email: branch.email,
    isActive: branch.isActive,
    isOnline: branch.isOnline,
    offlineMessage: branch.offlineMessage,
    sortOrder: branch.sortOrder,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}

export function presentBranchWithDistance(branch: BranchWithDistance) {
  return {
    ...presentBranch(branch),
    distanceKm: Math.round(branch.distanceKm * 10) / 10,
    isWithinRadius: branch.isWithinRadius,
  };
}
