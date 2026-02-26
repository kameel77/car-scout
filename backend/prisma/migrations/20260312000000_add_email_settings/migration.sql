-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "smtp_host" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "smtp_port" INTEGER;
ALTER TABLE "app_settings" ADD COLUMN "smtp_user" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "smtp_password" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "smtp_from_email" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "smtp_recipient_email" TEXT;

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "listing_id" DROP NOT NULL;
