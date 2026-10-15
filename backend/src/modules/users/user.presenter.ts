import type { User } from "../../generated/prisma/client.js";

export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    coinBalance: user.coinBalance,
    referralCode: user.referralCode,
    createdAt: user.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
