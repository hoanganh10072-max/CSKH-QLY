CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CustomerStatus" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'CUSTOMER', 'NOT_INTERESTED');
CREATE TYPE "OwnershipStatus" AS ENUM ('ACTIVE', 'RELEASED');
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DONE', 'CANCELLED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'STAFF',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "source" TEXT,
  "status" "CustomerStatus" NOT NULL DEFAULT 'NEW',
  "owner_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_ownerships" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "assigned_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_date" TIMESTAMP(3),
  "status" "OwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "customer_ownerships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_interactions" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "result" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_interactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_history" (
  "id" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "total_rows" INTEGER NOT NULL,
  "success_rows" INTEGER NOT NULL,
  "duplicate_rows" INTEGER NOT NULL,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
CREATE INDEX "customers_status_idx" ON "customers"("status");
CREATE INDEX "customers_owner_id_idx" ON "customers"("owner_id");
CREATE INDEX "customer_ownerships_customer_id_status_idx" ON "customer_ownerships"("customer_id", "status");
CREATE INDEX "customer_ownerships_user_id_status_idx" ON "customer_ownerships"("user_id", "status");
CREATE INDEX "customer_interactions_customer_id_created_at_idx" ON "customer_interactions"("customer_id", "created_at");
CREATE INDEX "customer_interactions_user_id_created_at_idx" ON "customer_interactions"("user_id", "created_at");
CREATE INDEX "tasks_user_id_deadline_idx" ON "tasks"("user_id", "deadline");
CREATE INDEX "tasks_customer_id_idx" ON "tasks"("customer_id");
CREATE INDEX "import_history_created_at_idx" ON "import_history"("created_at");

ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_ownerships" ADD CONSTRAINT "customer_ownerships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_ownerships" ADD CONSTRAINT "customer_ownerships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
