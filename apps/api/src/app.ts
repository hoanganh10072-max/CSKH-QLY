import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { customerRouter } from "./modules/customers/customers.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { taskRouter } from "./modules/tasks/tasks.routes.js";
import { userRouter } from "./modules/users/users.routes.js";

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
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cskh-api" });
});

app.use("/auth", authRouter);
app.use("/dashboard", dashboardRouter);
app.use("/customers", customerRouter);
app.use("/tasks", taskRouter);
app.use("/users", userRouter);

app.use(errorHandler);
