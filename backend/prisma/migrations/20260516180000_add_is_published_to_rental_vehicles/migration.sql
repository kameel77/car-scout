-- AlterTable (idempotent - column may already exist from prisma db push)
ALTER TABLE "rental_vehicles" ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rental_vehicles_is_published_idx" ON "rental_vehicles"("is_published");
