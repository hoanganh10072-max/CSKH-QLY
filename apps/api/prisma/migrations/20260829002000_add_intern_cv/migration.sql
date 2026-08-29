CREATE TABLE "intern_cvs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "intern_cvs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intern_cvs_user_id_key" ON "intern_cvs"("user_id");

ALTER TABLE "intern_cvs"
ADD CONSTRAINT "intern_cvs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
