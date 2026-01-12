-- CreateTable
CREATE TABLE IF NOT EXISTS "seo_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "gtm_id" TEXT,
    "home_title" TEXT,
    "home_description" TEXT,
    "home_og_image" TEXT,
    "listing_title" TEXT,
    "listing_description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_config_pkey" PRIMARY KEY ("id")
);
