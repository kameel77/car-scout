-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "marketplace" TEXT;

-- CreateIndex
CREATE INDEX "listings_marketplace_idx" ON "listings"("marketplace");
