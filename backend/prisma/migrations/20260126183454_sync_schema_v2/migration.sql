-- AlterTable
ALTER TABLE "financing_products" ADD COLUMN     "has_balloon_payment" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "financing_provider_connections" ADD COLUMN     "shop_uuid" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reset_password_expires" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" TEXT;
