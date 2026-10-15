import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { toE164 } from "../../lib/phone.js";
import { prisma } from "../../lib/prisma.js";
import { toPublicUser } from "./user.presenter.js";
import type { CustomerListQuery, ProfileUpdate } from "./users.schema.js";

export async function updateProfile(userId: string, input: ProfileUpdate) {
  const phone = input.phone ? toE164(input.phone) : undefined;
  if (phone) {
    const taken = await prisma.user.count({ where: { phone, id: { not: userId } } });
    if (taken) throw AppError.conflict("This phone number is already registered");
  }
  const user = await prisma.user.update({ where: { id: userId }, data: { ...input, phone } });
  return toPublicUser(user);
}

// ───────────────────────── admin: customers ─────────────────────────

export async function listCustomers(query: CustomerListQuery) {
  const and: Prisma.UserWhereInput[] = [{ role: "CUSTOMER" }];
  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({ OR: [{ name: contains }, { email: contains }, { phone: { contains: query.q } }] });
  }
  if (query.blocked !== undefined) and.push({ isBlocked: query.blocked });

  const where: Prisma.UserWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isBlocked: true,
        coinBalance: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const spend = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: rows.map((row) => row.id) }, status: "DELIVERED" },
    _sum: { payable: true },
  });
  const spendByUser = new Map(spend.map((group) => [group.userId, group._sum.payable ?? 0]));

  return {
    items: rows.map(({ _count, ...row }) => ({ ...row, orderCount: _count.orders, totalSpent: spendByUser.get(row.id) ?? 0 })),
    meta: pageMeta(query, total),
  };
}

export async function getCustomer(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    include: {
      addresses: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, orderNumber: true, status: true, payable: true, createdAt: true },
      },
      coinTransactions: { orderBy: { createdAt: "desc" }, take: 20 },
      referralReceived: {
        include: {
          referrer: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      referralsGiven: {
        include: {
          referee: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!user) throw AppError.notFound("Customer");
  const delivered = await prisma.order.aggregate({ where: { userId: id, status: "DELIVERED" }, _sum: { payable: true }, _count: true });
  const { passwordHash: _passwordHash, ...safe } = user;
  return { ...safe, stats: { deliveredOrders: delivered._count, totalSpent: delivered._sum.payable ?? 0 } };
}

export async function setBlocked(id: string, isBlocked: boolean) {
  const user = await prisma.user.findFirst({ where: { id, role: "CUSTOMER" }, select: { id: true } });
  if (!user) throw AppError.notFound("Customer");
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { isBlocked } }),
    // Blocking signs the customer out everywhere.
    ...(isBlocked ? [prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
  ]);
  return { id, isBlocked };
}
