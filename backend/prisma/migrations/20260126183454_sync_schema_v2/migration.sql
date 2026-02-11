-- AlterTable
ALTER TABLE "financing_products" ADD COLUMN IF NOT EXISTS "has_balloon_payment" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "financing_provider_connections" ADD COLUMN IF NOT EXISTS "shop_uuid" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_expires" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reset_password_token" TEXT;
