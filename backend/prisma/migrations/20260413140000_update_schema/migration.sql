-- Drop removed columns securely
ALTER TABLE "dealers" DROP COLUMN IF EXISTS "contact_name";
ALTER TABLE "users" DROP COLUMN IF EXISTS "phone";

-- Add missing columns to settings and seo
ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "home_description_de" TEXT;
ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "home_description_en" TEXT;
ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "home_title_de" TEXT;
ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "home_title_en" TEXT;
ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "listing_description_de" TEXT;
ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "listing_description_en" TEXT;
ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "listing_title_de" TEXT;
ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "listing_title_en" TEXT;
