ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'INTERN';

DROP INDEX IF EXISTS "users_role_work_mode_deleted_at_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "work_mode";
DROP TYPE IF EXISTS "EmployeeWorkMode";

CREATE INDEX "users_role_deleted_at_idx" ON "users"("role", "deleted_at");

CREATE TABLE "intern_daily_reports" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "work_date" DATE NOT NULL,
  "work_summary" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "challenges" TEXT,
  "plan_for_next_day" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "intern_daily_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intern_daily_reports_user_id_work_date_key"
ON "intern_daily_reports"("user_id", "work_date");

CREATE INDEX "intern_daily_reports_work_date_idx"
ON "intern_daily_reports"("work_date");

ALTER TABLE "intern_daily_reports"
ADD CONSTRAINT "intern_daily_reports_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
