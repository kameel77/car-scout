-- AlterTable (idempotent - column may already exist from prisma db push)
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "search_grid_columns" INTEGER NOT NULL DEFAULT 4;
