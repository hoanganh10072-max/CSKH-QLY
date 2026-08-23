CREATE TABLE "work_kpi_targets" (
    "id" TEXT NOT NULL,
    "period_mode" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "target_customers" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_kpi_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_kpi_targets_period_mode_period_key_key" ON "work_kpi_targets"("period_mode", "period_key");
CREATE INDEX "work_kpi_targets_period_mode_idx" ON "work_kpi_targets"("period_mode");
