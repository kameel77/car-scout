-- Guarded migration: add auto_refresh_images only if app_settings already exists.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'app_settings'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'app_settings'
              AND column_name = 'auto_refresh_images'
        ) THEN
            ALTER TABLE "app_settings"
            ADD COLUMN "auto_refresh_images" BOOLEAN NOT NULL DEFAULT false;
        END IF;
    END IF;
END $$;
