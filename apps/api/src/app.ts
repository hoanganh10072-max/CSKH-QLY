import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import type { Store } from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { runWithRequestPrisma } from "./config/prisma.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { customerRouter } from "./modules/customers/customers.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { taskRouter } from "./modules/tasks/tasks.routes.js";
import { userRouter } from "./modules/users/users.routes.js";

const createTimerlessRateLimitStore = (windowMs: number): Store => {
  const clients = new Map<string, { totalHits: number; resetTime: Date }>();

  const clearExpired = () => {
    const now = Date.now();
    for (const [key, client] of clients) {
      if (client.resetTime.getTime() <= now) clients.delete(key);
    }
  };

  return {
    localKeys: true,
    async increment(key) {
      clearExpired();
      const now = Date.now();
      const existing = clients.get(key);
      const client = existing && existing.resetTime.getTime() > now
        ? existing
        : { totalHits: 0, resetTime: new Date(now + windowMs) };

      client.totalHits += 1;
      clients.set(key, client);
      return client;
    },
    async decrement(key) {
      const client = clients.get(key);
      if (client && client.totalHits > 0) client.totalHits -= 1;
    },
    async resetKey(key) {
      clients.delete(key);
    },
    async resetAll() {
      clients.clear();
    }
  };
};
export const app = express();

const allowedOrigins = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Nguồn truy cập không được phép bởi CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "8mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
const rateLimitWindowMs = 15 * 60 * 1000;

app.use(
  rateLimit({
    windowMs: rateLimitWindowMs,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.get("cf-connecting-ip") || req.get("x-real-ip") || req.ip || "unknown",
    validate: {
      ip: false
    },
    store: createTimerlessRateLimitStore(rateLimitWindowMs)
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cskh-api" });
});

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  runWithRequestPrisma(
    () =>
      new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        res.once("finish", finish);
        res.once("close", finish);

        try {
          next();
        } catch (error) {
          reject(error);
        }
      })
  ).catch(next);
});

app.use("/auth", authRouter);
app.use("/dashboard", dashboardRouter);
app.use("/customers", customerRouter);
app.use("/tasks", taskRouter);
app.use("/users", userRouter);

app.use(errorHandler);


