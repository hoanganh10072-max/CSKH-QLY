ALTER TABLE "users" ADD COLUMN "username" TEXT;

UPDATE "users" SET "username" = 'admin' WHERE "email" = 'admin@cskh.local';
UPDATE "users" SET "username" = 'NV' WHERE "email" = 'staff@cskh.local';

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
