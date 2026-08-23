ALTER TABLE "customers" ADD COLUMN "company_head" TEXT;
ALTER TABLE "customers" ADD COLUMN "city" TEXT;
ALTER TABLE "customers" ADD COLUMN "import_id" TEXT;

ALTER TABLE "import_history" ADD COLUMN "import_name" TEXT;
UPDATE "import_history" SET "import_name" = "filename" WHERE "import_name" IS NULL;

CREATE INDEX "customers_import_id_idx" ON "customers"("import_id");
CREATE INDEX "customers_city_idx" ON "customers"("city");

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_import_id_fkey"
  FOREIGN KEY ("import_id") REFERENCES "import_history"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
