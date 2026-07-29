-- CreateEnum
CREATE TYPE "LpSelectionMode" AS ENUM ('MANUAL', 'FILTERED');

-- CreateTable
CREATE TABLE "landing_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_indexable" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "hero_title" TEXT NOT NULL,
    "hero_subtitle" TEXT,
    "hero_badge" TEXT,
    "hero_image_url" TEXT,
    "cta_label" TEXT NOT NULL DEFAULT 'Oddzwońcie do mnie',
    "discount" INTEGER,
    "initial_payment" INTEGER,
    "selection_mode" "LpSelectionMode" NOT NULL DEFAULT 'FILTERED',
    "listing_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filter_params" JSONB,
    "max_listings" INTEGER NOT NULL DEFAULT 12,
    "sections" JSONB,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "landing_page_id" TEXT,
ADD COLUMN "traffic_source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "landing_pages_slug_key" ON "landing_pages"("slug");

-- CreateIndex
CREATE INDEX "landing_pages_is_active_slug_idx" ON "landing_pages"("is_active", "slug");

-- CreateIndex
CREATE INDEX "leads_landing_page_id_idx" ON "leads"("landing_page_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
