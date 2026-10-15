import dns from "node:dns";
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

dns.setDefaultResultOrder("ipv4first");

if (existsSync(".env")) process.loadEnvFile(".env");

// Migrations must use Neon's direct (non-pooled) connection; runtime uses the pooled URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
