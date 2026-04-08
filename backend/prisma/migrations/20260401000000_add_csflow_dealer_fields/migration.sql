-- AlterTable
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "csflow_dealer_id" INTEGER;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "postal_code" TEXT;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "contact_email" TEXT;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "contact_email_service" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "dealers_csflow_dealer_id_key" ON "dealers"("csflow_dealer_id");
