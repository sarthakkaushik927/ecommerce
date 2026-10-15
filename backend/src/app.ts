import compression from "compression";
import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import _helmet, { type HelmetOptions } from "helmet";
import path from "node:path";
import { pinoHttp } from "pino-http";
import { env, isTest } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { apiLimiter } from "./middleware/rate-limit.js";
import { apiRouter } from "./routes.js";

type HelmetFn = (options?: Readonly<HelmetOptions>) => RequestHandler;
const helmet: HelmetFn = (_helmet as unknown as { default?: HelmetFn }).default ?? (_helmet as unknown as HelmetFn);

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      // Native mobile requests carry no Origin header; browsers are restricted to the allow-list.
      origin: (origin, callback) => callback(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  if (!isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/v1/health" } }));

  app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR), { maxAge: "7d", immutable: true }));
  app.use("/api/v1", apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
