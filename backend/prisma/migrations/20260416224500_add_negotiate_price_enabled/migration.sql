-- AlterTable (idempotent - column may already exist from prisma db push)
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "negotiate_price_enabled" BOOLEAN NOT NULL DEFAULT true;
