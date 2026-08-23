CREATE TABLE "daily_work_kpis" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "target_customers" INTEGER NOT NULL DEFAULT 0,
    "received_customers" INTEGER NOT NULL DEFAULT 0,
    "called_customers" INTEGER NOT NULL DEFAULT 0,
    "successful_calls" INTEGER NOT NULL DEFAULT 0,
    "interested_customers" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_work_kpis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_work_kpis_user_id_work_date_key" ON "daily_work_kpis"("user_id", "work_date");
CREATE INDEX "daily_work_kpis_work_date_idx" ON "daily_work_kpis"("work_date");

ALTER TABLE "daily_work_kpis"
ADD CONSTRAINT "daily_work_kpis_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
