CREATE TYPE "ConsultationCallStatus" AS ENUM ('NOT_REACHED', 'CALLED');

CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'NOT_SENT');

ALTER TABLE "customer_interactions"
ADD COLUMN "call_status" "ConsultationCallStatus",
ADD COLUMN "message_status" "MessageStatus",
ADD COLUMN "no_message_reason" TEXT;
