import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import type { CreateBranchBody, UpdateBranchBody } from "./branch.schema.js";
import type { BranchWithDistance } from "./branch.presenter.js";

// ─── Geo ──────────────────────────────────────────────────────────────────

/**
 * Haversine great-circle distance between two points (decimal degrees).
 * Accurate enough for delivery-radius checks (error < 0.5% for distances under 100 km).
 * Pure function — no external library, fully unit-testable.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Public queries ───────────────────────────────────────────────────────

/**
 * Returns active branches sorted by distance from the given coordinates.
 * Each branch includes `distanceKm` and `isWithinRadius`.
 */
export async function listBranchesByDistance(lat: number, lng: number, limit = 10): Promise<BranchWithDistance[]> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return branches
    .map((b) => {
      const distanceKm = haversineKm(lat, lng, b.lat, b.lng);
      return { ...b, distanceKm, isWithinRadius: distanceKm <= b.deliveryRadiusKm };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/**
 * Returns the nearest online+active branch that covers the given point.
 * Falls back to the nearest online branch if none covers it (best-effort).
 * Throws SERVICE_UNAVAILABLE if no online branch exists at all.
 */
export async function findNearestBranch(lat: number, lng: number) {
  const onlineBranches = await prisma.branch.findMany({
    where: { isActive: true, isOnline: true },
  });
  if (onlineBranches.length === 0) {
    throw AppError.serviceUnavailable("All branches are currently offline. Please try again later.");
  }

  const withDistance = onlineBranches
    .map((b) => ({ ...b, distanceKm: haversineKm(lat, lng, b.lat, b.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Prefer the nearest branch that covers the point with its delivery radius.
  const covering = withDistance.filter((b) => b.distanceKm <= b.deliveryRadiusKm);
  const chosen = covering[0] ?? withDistance[0]!;
  return { ...chosen, isWithinRadius: chosen.distanceKm <= chosen.deliveryRadiusKm };
}

export async function getBranchById(id: string) {
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) throw AppError.notFound("Branch");
  return branch;
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────

export async function listBranchesAdmin() {
  const branches = await prisma.branch.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { orders: true, riders: true } },
      branchStock: { select: { stock: true } },
    },
  });

  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    city: b.city,
    state: b.state,
    isActive: b.isActive,
    isOnline: b.isOnline,
    offlineMessage: b.offlineMessage,
    deliveryRadiusKm: b.deliveryRadiusKm,
    sortOrder: b.sortOrder,
    orderCount: b._count.orders,
    riderCount: b._count.riders,
    totalStock: b.branchStock.reduce((sum, s) => sum + s.stock, 0),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));
}

export async function createBranch(input: CreateBranchBody) {
  const existing = await prisma.branch.findUnique({ where: { slug: input.slug } });
  if (existing) throw AppError.conflict("Branch slug is already taken");
  return prisma.branch.create({ data: input });
}

export async function updateBranch(id: string, input: UpdateBranchBody) {
  await getBranchById(id);
  if (input.slug) {
    const conflict = await prisma.branch.findFirst({ where: { slug: input.slug, NOT: { id } } });
    if (conflict) throw AppError.conflict("Branch slug is already taken");
  }
  return prisma.branch.update({ where: { id }, data: input });
}

export async function deleteBranch(id: string) {
  const branch = await getBranchById(id);
  // If there are any orders, deactivate instead of hard-delete.
  const orderCount = await prisma.order.count({ where: { branchId: id } });
  if (orderCount > 0) {
    return prisma.branch.update({ where: { id }, data: { isActive: false } });
  }
  await prisma.branch.delete({ where: { id } });
  return branch;
}

// ─── Online/Offline toggle ────────────────────────────────────────────────

/**
 * Sets the operational status of a branch and writes an audit log row
 * in the same transaction.
 */
export async function setBranchOnlineStatus(
  branchId: string,
  isOnline: boolean,
  reason: string | undefined,
  actorId: string,
) {
  const branch = await prisma.$transaction(async (tx) => {
    await getBranchById(branchId); // validate existence
    const updated = await tx.branch.update({
      where: { id: branchId },
      data: { isOnline },
    });
    await tx.branchStatusLog.create({
      data: { branchId, isOnline, reason, actorId },
    });
    return updated;
  });

  // If taking branch offline, log a warning for in-flight orders (notifications sent in Phase 6).
  if (!isOnline) {
    const affectedCount = await prisma.order.count({
      where: { branchId, status: { in: ["PLACED", "CONFIRMED", "PACKED"] } },
    });
    if (affectedCount > 0) {
      logger.warn({ branchId, affectedCount }, "Branch taken offline with in-flight orders");
    }
  }

  return branch;
}

// ─── Order resolution ─────────────────────────────────────────────────────

/**
 * Resolves the branch that should fulfil an order.
 *
 * Priority:
 *   1. The customer's preferred branch — if it is online and active.
 *   2. The nearest online branch to the delivery address.
 *   3. Any online branch (last resort; a warning is logged).
 *
 * Throws SERVICE_UNAVAILABLE (503) if no branch is online at all.
 */
export async function resolveBranchForOrder(
  preferredBranchId: string | undefined,
  lat: number,
  lng: number,
): Promise<string> {
  // 1. Preferred branch (if valid)
  if (preferredBranchId) {
    const preferred = await prisma.branch.findUnique({ where: { id: preferredBranchId } });
    if (preferred?.isActive && preferred.isOnline) {
      return preferred.id;
    }
    // Preferred branch is offline — fall through to geo-detect.
    logger.info({ preferredBranchId }, "Preferred branch offline; auto-resolving to nearest online branch");
  }

  // 2. Nearest online branch to the coordinates.
  const nearest = await findNearestBranch(lat, lng);
  return nearest.id;
}

// ─── Rider assignment ─────────────────────────────────────────────────────

export async function getBranchRiders(branchId: string) {
  await getBranchById(branchId);
  return prisma.rider.findMany({
    where: { branches: { some: { branchId } } },
    orderBy: { name: "asc" },
  });
}

export async function assignRiderToBranch(branchId: string, riderId: string) {
  await getBranchById(branchId);
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw AppError.notFound("Rider");

  return prisma.branchRider.upsert({
    where: { branchId_riderId: { branchId, riderId } },
    update: {},
    create: { branchId, riderId },
  });
}

export async function unassignRiderFromBranch(branchId: string, riderId: string) {
  await getBranchById(branchId);
  const existing = await prisma.branchRider.findUnique({
    where: { branchId_riderId: { branchId, riderId } },
  });
  if (!existing) throw AppError.notFound("Rider assignment");
  await prisma.branchRider.delete({ where: { branchId_riderId: { branchId, riderId } } });
}
