-- AlterTable
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "import_source" TEXT;
