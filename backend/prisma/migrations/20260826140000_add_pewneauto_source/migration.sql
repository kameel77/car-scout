-- AlterEnum
ALTER TYPE "EntrySource" ADD VALUE IF NOT EXISTS 'PEWNEAUTO';

-- CreateTable
CREATE TABLE IF NOT EXISTS "pewneauto_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_encrypted" TEXT NOT NULL,
    "token_url" TEXT NOT NULL DEFAULT 'https://panel.pewneauto.pl/oauth2/server/access-token',
    "api_url" TEXT NOT NULL DEFAULT 'https://panel.pewneauto.pl/api/data-cars-list/get',
    "domain_header" TEXT NOT NULL DEFAULT 'pewneauto.pl',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "dealer_group_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_successful_sync_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pewneauto_sources_pkey" PRIMARY KEY ("id")
);

-- Ensure column exists even if table was created previously without domain_header
ALTER TABLE "pewneauto_sources" ADD COLUMN IF NOT EXISTS "domain_header" TEXT NOT NULL DEFAULT 'pewneauto.pl';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pewneauto_sources_slug_key" ON "pewneauto_sources"("slug");

-- AlterTable (listings)
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "is_reserved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pewneauto_source_id" TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pewneauto_car_id" INTEGER;

-- CreateIndex (listings)
CREATE INDEX IF NOT EXISTS "listings_pewneauto_source_id_idx" ON "listings"("pewneauto_source_id");
CREATE UNIQUE INDEX IF NOT EXISTS "listings_pewneauto_source_id_pewneauto_car_id_key" ON "listings"("pewneauto_source_id", "pewneauto_car_id");

-- AlterTable (dealers)
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "pewneauto_dealer_code" TEXT;
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "pewneauto_source_id" TEXT;

-- CreateIndex (dealers)
CREATE UNIQUE INDEX IF NOT EXISTS "dealers_pewneauto_source_id_pewneauto_dealer_code_key" ON "dealers"("pewneauto_source_id", "pewneauto_dealer_code");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pewneauto_sources_dealer_group_id_fkey') THEN
        ALTER TABLE "pewneauto_sources" ADD CONSTRAINT "pewneauto_sources_dealer_group_id_fkey" FOREIGN KEY ("dealer_group_id") REFERENCES "dealer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_pewneauto_source_id_fkey') THEN
        ALTER TABLE "listings" ADD CONSTRAINT "listings_pewneauto_source_id_fkey" FOREIGN KEY ("pewneauto_source_id") REFERENCES "pewneauto_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dealers_pewneauto_source_id_fkey') THEN
        ALTER TABLE "dealers" ADD CONSTRAINT "dealers_pewneauto_source_id_fkey" FOREIGN KEY ("pewneauto_source_id") REFERENCES "pewneauto_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
