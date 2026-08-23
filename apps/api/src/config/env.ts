import "dotenv/config";
import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional()
);

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional()
);

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  STAFF_DAILY_CUSTOMER_TARGET: z.coerce.number().int().nonnegative().default(50),
  SUPABASE_STORAGE_ENABLED: booleanEnv.default(false),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_CALL_IMAGES_BUCKET: z.string().trim().min(1).default("cskh-call-images"),
  NODE_ENV: z.string().default("development")
}).superRefine((value, context) => {
  if (!value.SUPABASE_STORAGE_ENABLED) return;

  if (!value.SUPABASE_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SUPABASE_URL"],
      message: "Cần cấu hình SUPABASE_URL khi bật Supabase Storage"
    });
  }

  if (!value.SUPABASE_SERVICE_ROLE_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SUPABASE_SERVICE_ROLE_KEY"],
      message: "Cần cấu hình SUPABASE_SERVICE_ROLE_KEY khi bật Supabase Storage"
    });
  }
});

export const env = envSchema.parse(process.env);
