import type { OrderStatus, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { inBackground, notifyOrderStatus } from "../../services/notify/index.js";
import { changeCoins } from "../coins/coins.service.js";
import { applyStockChange } from "../inventory/inventory.service.js";
import { canTransition } from "./order-status.js";

export type Actor = { id: string; role: "CUSTOMER" | "ADMIN" };

type TransitionOptions = { actor: Actor; note?: string; reason?: string };

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

async function restock(db: Db, order: OrderWithItems, type: "CANCEL" | "RETURN", actorId: string) {
  for (const item of order.items) {
    await applyStockChange(db, {
      variantId: item.variantId,
      delta: item.quantity,
      type,
      reason: `${type === "CANCEL" ? "Cancelled" : "Returned"} order ${order.orderNumber}`,
      orderId: order.id,
      actorId,
    });
    await db.product.update({ where: { id: item.productId }, data: { soldCount: { decrement: item.quantity } } });
  }
}

async function refundRedeemedCoins(db: Db, order: OrderWithItems) {
  if (order.coinsUsed > 0) {
    await changeCoins(db, {
      userId: order.userId,
      amount: order.coinsUsed,
      type: "REFUND",
      orderId: order.id,
      note: `Refund for ${order.orderNumber}`,
    });
  }
}

async function releaseCoupon(db: Db, order: OrderWithItems) {
  if (!order.couponId) return;
  const { count } = await db.couponRedemption.deleteMany({ where: { orderId: order.id } });
  if (count > 0) await db.coupon.update({ where: { id: order.couponId }, data: { usedCount: { decrement: 1 } } });
}

async function reverseReferralReward(db: Db, order: OrderWithItems) {
  const referral = await db.referral.findFirst({
    where: { orderId: order.id, status: "COMPLETED" },
  });
  if (!referral) return;

  if (referral.referrerCoins > 0) {
    const referrer = await db.user.findUnique({
      where: { id: referral.referrerId },
      select: { coinBalance: true },
    });
    if (referrer) {
      const reversible = Math.min(referral.referrerCoins, referrer.coinBalance);
      if (reversible > 0) {
        await changeCoins(db, {
          userId: referral.referrerId,
          amount: -reversible,
          type: "REVERSE",
          orderId: order.id,
          note: `Referral reward reversed for order ${order.orderNumber}`,
        });
      }
    }
  }

  if (referral.refereeCoins > 0) {
    const referee = await db.user.findUnique({
      where: { id: referral.refereeId },
      select: { coinBalance: true },
    });
    if (referee) {
      const reversible = Math.min(referral.refereeCoins, referee.coinBalance);
      if (reversible > 0) {
        await changeCoins(db, {
          userId: referral.refereeId,
          amount: -reversible,
          type: "REVERSE",
          orderId: order.id,
          note: `Referral bonus reversed for order ${order.orderNumber}`,
        });
      }
    }
  }

  await db.referral.update({
    where: { id: referral.id },
    data: { status: "REVERSED", reversedAt: new Date() },
  });
}

/** Side effects that must commit together with the status change. */
async function applySideEffects(db: Db, order: OrderWithItems, to: OrderStatus, actor: Actor, reason?: string) {
  const data: Prisma.OrderUpdateManyMutationInput = {};

  switch (to) {
    case "CANCELLED":
      await restock(db, order, "CANCEL", actor.id);
      await refundRedeemedCoins(db, order);
      await releaseCoupon(db, order);
      await reverseReferralReward(db, order);
      data.cancelledAt = new Date();
      data.cancelReason = reason ?? null;
      break;

    case "DELIVERED": {
      data.deliveredAt = new Date();
      data.paymentStatus = "PAID";
      if (order.coinsToEarn > 0) {
        await changeCoins(db, {
          userId: order.userId,
          amount: order.coinsToEarn,
          type: "EARN",
          orderId: order.id,
          note: `Earned on ${order.orderNumber}`,
        });
        data.coinsEarned = order.coinsToEarn;
      }

      // Referral reward trigger: strictly on referee's first DELIVERED order
      const priorDelivered = await db.order.count({
        where: { userId: order.userId, status: "DELIVERED", id: { not: order.id } },
      });
      if (priorDelivered === 0) {
        const referral = await db.referral.findUnique({
          where: { refereeId: order.userId },
        });
        if (referral && referral.status === "PENDING") {
          if (referral.referrerCoins > 0) {
            await changeCoins(db, {
              userId: referral.referrerId,
              amount: referral.referrerCoins,
              type: "BONUS",
              orderId: order.id,
              note: `Referral reward for referring customer`,
            });
          }
          if (referral.refereeCoins > 0) {
            await changeCoins(db, {
              userId: referral.refereeId,
              amount: referral.refereeCoins,
              type: "BONUS",
              orderId: order.id,
              note: `Welcome referral bonus on first order`,
            });
          }
          await db.referral.update({
            where: { id: referral.id },
            data: {
              status: "COMPLETED",
              orderId: order.id,
              completedAt: new Date(),
            },
          });
        }
      }
      break;
    }

    case "RETURN_REQUESTED":
      data.returnReason = reason ?? null;
      break;

    case "RETURNED": {
      await restock(db, order, "RETURN", actor.id);
      await refundRedeemedCoins(db, order);
      if (order.coinsEarned > 0) {
        // Reverse earned coins, but never push the balance negative if they were already spent.
        const { coinBalance } = await db.user.findUniqueOrThrow({ where: { id: order.userId }, select: { coinBalance: true } });
        const reversible = Math.min(order.coinsEarned, coinBalance);
        if (reversible > 0) {
          await changeCoins(db, {
            userId: order.userId,
            amount: -reversible,
            type: "REVERSE",
            orderId: order.id,
            note: `Reversed for returned ${order.orderNumber}`,
          });
        }
      }
      await reverseReferralReward(db, order);
      data.paymentStatus = order.paymentStatus === "PAID" ? "REFUNDED" : order.paymentStatus;
      break;
    }

    case "RETURN_REJECTED":
      break;

    default:
      break;
  }
  return data;
}

/**
 * Moves an order to a new status inside one transaction (status, side effects, history),
 * then notifies the customer in the background.
 */
export async function transitionOrder(orderId: string, to: OrderStatus, { actor, note, reason }: TransitionOptions) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw AppError.notFound("Order");
    if (!canTransition(order.status, to)) {
      throw new AppError("INVALID_TRANSITION", `Cannot move an order from ${order.status} to ${to}`);
    }
    if (to === "RIDER_ASSIGNED") throw AppError.badRequest("Use the assign-rider action to assign a rider");
    if (to === "OUT_FOR_DELIVERY" && !order.riderId) throw AppError.badRequest("Assign a rider before dispatch");

    const data = await applySideEffects(tx, order, to, actor, reason);

    // Conditional update guards against two admins changing the same order concurrently.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { ...data, status: to },
    });
    if (count === 0) throw AppError.conflict("The order was updated by someone else; refresh and try again");

    await tx.orderStatusHistory.create({
      data: { orderId, status: to, note: note ?? reason, actorId: actor.id, actorRole: actor.role },
    });
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  });

  inBackground(() => notifyOrderStatus(orderId, to, reason));
  return updated;
}
