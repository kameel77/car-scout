-- DropIndex
DROP INDEX "listings_broker_price_eur_idx";

-- DropIndex
DROP INDEX "listings_broker_price_pln_idx";

-- DropIndex
DROP INDEX "listings_created_at_idx";

-- DropIndex
DROP INDEX "listings_mileage_km_idx";

-- AlterTable
ALTER TABLE "seo_config" ALTER COLUMN "updated_at" DROP DEFAULT;
