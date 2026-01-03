-- Add auto-refresh flag after app_settings exists
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "auto_refresh_images" BOOLEAN NOT NULL DEFAULT false;
