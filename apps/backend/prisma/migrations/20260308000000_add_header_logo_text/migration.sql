-- AlterTable: Add missing logo text columns to app_settings
ALTER TABLE "app_settings" 
ADD COLUMN IF NOT EXISTS "header_logo_text_pl" TEXT,
ADD COLUMN IF NOT EXISTS "header_logo_text_en" TEXT,
ADD COLUMN IF NOT EXISTS "header_logo_text_de" TEXT;
