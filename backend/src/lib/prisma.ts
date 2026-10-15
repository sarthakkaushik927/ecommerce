import dns from "node:dns";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { RetryingPool } from "./db-pool.js";
import { PrismaClient, type Prisma } from "../generated/prisma/client.js";

dns.setDefaultResultOrder("ipv4first");

// Honour `?schema=` in the URL (used to isolate the integration-test schema).
const schema = new URL(env.DATABASE_URL).searchParams.get("schema") ?? undefined;
// pg waits forever by default, which hung requests for minutes when a Neon connect stalled.
// Keep connections warm so new connects are rare, give connects and queries a deadline, and
// retry stalled connects (see RetryingPool).
export const pool = new RetryingPool({
  connectionString: env.DATABASE_URL,
  keepAlive: true,
  keepAliveInitialDelayMillis: 30_000,
  idleTimeoutMillis: 240_000,
  connectionTimeoutMillis: 6_000,
  query_timeout: 25_000,
});
const adapter = new PrismaPg(pool, { schema });

export const prisma = new PrismaClient({
  adapter,
  // Serverless Postgres adds network latency per query; give multi-step transactions headroom.
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
});

/** Accepts both the root client and an interactive-transaction client. */
export type Db = Prisma.TransactionClient;
