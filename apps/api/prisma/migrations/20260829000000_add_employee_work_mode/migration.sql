CREATE TYPE "EmployeeWorkMode" AS ENUM ('ONLINE', 'OFFLINE');

ALTER TABLE "users"
ADD COLUMN "work_mode" "EmployeeWorkMode" NOT NULL DEFAULT 'OFFLINE';

CREATE INDEX "users_role_work_mode_deleted_at_idx"
ON "users"("role", "work_mode", "deleted_at");
