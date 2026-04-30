-- CreateEnum
CREATE TYPE "FinancingPriceBase" AS ENUM ('PRICE_PLN', 'BROKER_PRICE_PLN');

-- CreateEnum
CREATE TYPE "ListingCondition" AS ENUM ('NEW', 'USED');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('CSV', 'CSFLOW', 'MANUAL');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "catalog_price" INTEGER,
ADD COLUMN IF NOT EXISTS "condition" "ListingCondition" NOT NULL DEFAULT 'USED',
ADD COLUMN IF NOT EXISTS "financing_price_base" "FinancingPriceBase" NOT NULL DEFAULT 'BROKER_PRICE_PLN',
ADD COLUMN IF NOT EXISTS "is_chinese_brand" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "last_manual_edit_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "entry_source" "EntrySource";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_condition_idx" ON "listings"("condition");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_is_chinese_brand_idx" ON "listings"("is_chinese_brand");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_last_manual_edit_at_idx" ON "listings"("last_manual_edit_at");

-- Backfill entry_source from existing import_source
UPDATE "listings" SET "entry_source" = 'CSFLOW' WHERE "import_source" = 'csflow';
UPDATE "listings" SET "entry_source" = 'CSV' WHERE "entry_source" IS NULL;
