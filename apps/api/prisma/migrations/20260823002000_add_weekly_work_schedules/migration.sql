CREATE TABLE "weekly_work_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "monday_start" TEXT,
    "monday_end" TEXT,
    "tuesday_start" TEXT,
    "tuesday_end" TEXT,
    "wednesday_start" TEXT,
    "wednesday_end" TEXT,
    "thursday_start" TEXT,
    "thursday_end" TEXT,
    "friday_start" TEXT,
    "friday_end" TEXT,
    "saturday_start" TEXT,
    "saturday_end" TEXT,
    "sunday_start" TEXT,
    "sunday_end" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_work_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "weekly_work_schedules_user_id_week_start_key" ON "weekly_work_schedules"("user_id", "week_start");
CREATE INDEX "weekly_work_schedules_week_start_idx" ON "weekly_work_schedules"("week_start");

ALTER TABLE "weekly_work_schedules"
ADD CONSTRAINT "weekly_work_schedules_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
