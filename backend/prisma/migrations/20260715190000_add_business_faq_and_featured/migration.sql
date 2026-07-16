-- AlterEnum: Add 'business' to FaqPage
ALTER TYPE "FaqPage" ADD VALUE IF NOT EXISTS 'business';

-- AlterTable: Add is_business_featured to listings
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "is_business_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_is_business_featured_idx" ON "listings"("is_business_featured");
