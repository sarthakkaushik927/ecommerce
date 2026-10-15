import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

if (existsSync(".env")) process.loadEnvFile(".env");

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    // Integration files share one database; run them one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl || "postgresql://mock:mock@localhost:5432/mock",
      DIRECT_URL: testDatabaseUrl || "postgresql://mock:mock@localhost:5432/mock",
      JWT_ACCESS_SECRET: "test-access-secret-minimum-32-characters-long",
      JWT_REFRESH_SECRET: "test-refresh-secret-minimum-32-characters-long",
      SMTP_HOST: "",
      WHATSAPP_PROVIDER: "log",
    },
  },
});
