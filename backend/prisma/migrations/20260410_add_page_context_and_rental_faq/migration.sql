-- AlterEnum: Add 'rental' to FaqPage
ALTER TYPE "FaqPage" ADD VALUE IF NOT EXISTS 'rental';

-- AlterTable: Add page_context to faq_entries
ALTER TABLE "faq_entries" ADD COLUMN IF NOT EXISTS "page_context" TEXT NOT NULL DEFAULT 'all';

-- AlterTable: Add page_context to partner_ads
ALTER TABLE "partner_ads" ADD COLUMN IF NOT EXISTS "page_context" TEXT NOT NULL DEFAULT 'all';
