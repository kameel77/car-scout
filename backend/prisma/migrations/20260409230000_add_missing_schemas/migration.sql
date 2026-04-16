-- Missing Enums
DO $$ BEGIN
    CREATE TYPE "ScopeType" AS ENUM ('PLATFORM', 'DEALER_GROUP', 'DEALER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MemberRole" AS ENUM ('SUPERADMIN_PLATFORM', 'PLATFORM_MANAGER', 'DEALER_GROUP_ADMIN', 'DEALER_ADMIN', 'DEALER_EMPLOYEE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ContactMode" AS ENUM ('DEALER_GENERIC', 'DEALER_EMPLOYEE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Missing Fields
ALTER TABLE "dealers" ADD COLUMN IF NOT EXISTS "dealer_group_id" TEXT;

-- Missing Tables
CREATE TABLE IF NOT EXISTS "crm_tracking_sessions" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_tracking_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_tracking_visits" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visited_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_tracking_visits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seo_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "gtm_id" TEXT,
    "home_title" TEXT,
    "home_description" TEXT,
    "home_og_image" TEXT,
    "listing_title" TEXT,
    "listing_description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "home_description_de" TEXT,
    "home_description_en" TEXT,
    "home_title_de" TEXT,
    "home_title_en" TEXT,
    "listing_description_de" TEXT,
    "listing_description_en" TEXT,
    "listing_title_de" TEXT,
    "listing_title_en" TEXT,
    CONSTRAINT "seo_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partner_ads" (
    "id" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "page_context" TEXT NOT NULL DEFAULT 'all',
    "title" TEXT,
    "description" TEXT,
    "subtitle" TEXT,
    "cta_text" TEXT,
    "url" TEXT NOT NULL,
    "image_url" TEXT,
    "brand_name" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "overlay_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "cta_text_de" TEXT,
    "cta_text_en" TEXT,
    "description_de" TEXT,
    "description_en" TEXT,
    "subtitle_de" TEXT,
    "subtitle_en" TEXT,
    "title_de" TEXT,
    "title_en" TEXT,
    "hide_ui_elements" BOOLEAN NOT NULL DEFAULT false,
    "mobile_image_url" TEXT,
    CONSTRAINT "partner_ads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dealer_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address_line1" TEXT,
    "city" TEXT,
    "nip" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dealer_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "is_default_context" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dealer_group_settings" (
    "id" TEXT NOT NULL,
    "dealer_group_id" TEXT NOT NULL,
    "header_logo_url" TEXT,
    "footer_logo_url" TEXT,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_user" TEXT,
    "smtp_password" TEXT,
    "smtp_from_email" TEXT,
    "smtp_recipient_email" TEXT,
    CONSTRAINT "dealer_group_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dealer_settings" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "header_logo_url" TEXT,
    "footer_logo_url" TEXT,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_user" TEXT,
    "smtp_password" TEXT,
    "smtp_from_email" TEXT,
    "smtp_recipient_email" TEXT,
    CONSTRAINT "dealer_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "nip" TEXT,
    "contact_person" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- Missing Indices
CREATE INDEX IF NOT EXISTS "crm_tracking_sessions_uuid_idx" ON "crm_tracking_sessions"("uuid");
CREATE INDEX IF NOT EXISTS "crm_tracking_sessions_uuid_last_seen_at_idx" ON "crm_tracking_sessions"("uuid", "last_seen_at");
CREATE INDEX IF NOT EXISTS "crm_tracking_visits_session_id_idx" ON "crm_tracking_visits"("session_id");
CREATE INDEX IF NOT EXISTS "crm_tracking_visits_session_id_visited_at_idx" ON "crm_tracking_visits"("session_id", "visited_at");
CREATE INDEX IF NOT EXISTS "partner_ads_placement_idx" ON "partner_ads"("placement");
CREATE INDEX IF NOT EXISTS "partner_ads_is_active_idx" ON "partner_ads"("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "dealer_groups_name_key" ON "dealer_groups"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "dealer_groups_slug_key" ON "dealer_groups"("slug");
CREATE INDEX IF NOT EXISTS "memberships_user_id_scope_type_scope_id_idx" ON "memberships"("user_id", "scope_type", "scope_id");
CREATE INDEX IF NOT EXISTS "memberships_scope_type_scope_id_idx" ON "memberships"("scope_type", "scope_id");
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_user_id_scope_type_scope_id_role_key" ON "memberships"("user_id", "scope_type", "scope_id", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "dealer_group_settings_dealer_group_id_key" ON "dealer_group_settings"("dealer_group_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dealer_settings_dealer_id_key" ON "dealer_settings"("dealer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "partners_api_key_key" ON "partners"("api_key");
CREATE INDEX IF NOT EXISTS "partners_api_key_idx" ON "partners"("api_key");
CREATE INDEX IF NOT EXISTS "partners_is_active_idx" ON "partners"("is_active");

-- Missing Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_tracking_visits_session_id_fkey') THEN
        ALTER TABLE "crm_tracking_visits" ADD CONSTRAINT "crm_tracking_visits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "crm_tracking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memberships_user_id_fkey') THEN
        ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dealer_group_settings_dealer_group_id_fkey') THEN
        ALTER TABLE "dealer_group_settings" ADD CONSTRAINT "dealer_group_settings_dealer_group_id_fkey" FOREIGN KEY ("dealer_group_id") REFERENCES "dealer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dealer_settings_dealer_id_fkey') THEN
        ALTER TABLE "dealer_settings" ADD CONSTRAINT "dealer_settings_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dealers_dealer_group_id_fkey') THEN
        ALTER TABLE "dealers" ADD CONSTRAINT "dealers_dealer_group_id_fkey" FOREIGN KEY ("dealer_group_id") REFERENCES "dealer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
