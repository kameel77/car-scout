-- Drop existing tables (no data yet) and recreate with correct schema
-- Order matters: drop children first, then parents

DROP TABLE IF EXISTS "rental_matrix_entries" CASCADE;
DROP TABLE IF EXISTS "vehicle_rental_assignments" CASCADE;
DROP TABLE IF EXISTS "rental_companies" CASCADE;
DROP TABLE IF EXISTS "rental_vehicles" CASCADE;

-- Remove lead rental columns added in previous migration
ALTER TABLE "leads" DROP COLUMN IF EXISTS "lead_type";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "rental_vehicle_id";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "rental_company_name";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "rental_annual_mileage_km";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "rental_contract_months";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "rental_initial_payment_pct";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "rental_monthly_rate";

DROP INDEX IF EXISTS "leads_rental_vehicle_id_idx";
DROP INDEX IF EXISTS "leads_lead_type_idx";

-- ============================================================
-- Recreate all tables matching the Prisma schema exactly
-- ============================================================

-- CreateTable: rental_vehicles
CREATE TABLE "rental_vehicles" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT,
    "body_type" TEXT,
    "fuel_type" TEXT,
    "transmission" TEXT,
    "engine_power_hp" INTEGER,
    "engine_capacity_cm3" INTEGER,
    "production_year" INTEGER NOT NULL,
    "color" TEXT,
    "paint_type" TEXT,
    "doors" INTEGER,
    "seats" INTEGER,
    "drive" TEXT,
    "catalog_price" INTEGER NOT NULL,
    "selling_price" INTEGER NOT NULL,
    "primary_image_url" TEXT,
    "image_urls" TEXT[],
    "equipment_audio_multimedia" TEXT[],
    "equipment_safety" TEXT[],
    "equipment_comfort_extras" TEXT[],
    "equipment_other" TEXT[],
    "additional_info_header" TEXT,
    "additional_info_content" TEXT,
    "specs_json" JSONB,
    "slug" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rental_companies
CREATE TABLE "rental_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "logo_url" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vehicle_rental_assignments
CREATE TABLE "vehicle_rental_assignments" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "rental_company_id" TEXT NOT NULL,
    "external_vehicle_id" TEXT,
    "calculation_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_rental_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rental_matrix_entries
CREATE TABLE "rental_matrix_entries" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "annual_mileage_km" INTEGER NOT NULL,
    "contract_months" INTEGER NOT NULL,
    "initial_payment_pct" DOUBLE PRECISION NOT NULL,
    "monthly_rate_net" DOUBLE PRECISION NOT NULL,
    "monthly_rate_gross" DOUBLE PRECISION NOT NULL,
    "services_included" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_matrix_entries_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add rental fields to leads
ALTER TABLE "leads" ADD COLUMN "lead_type" TEXT NOT NULL DEFAULT 'sale';
ALTER TABLE "leads" ADD COLUMN "rental_vehicle_id" TEXT;
ALTER TABLE "leads" ADD COLUMN "rental_company_name" TEXT;
ALTER TABLE "leads" ADD COLUMN "rental_annual_mileage_km" INTEGER;
ALTER TABLE "leads" ADD COLUMN "rental_contract_months" INTEGER;
ALTER TABLE "leads" ADD COLUMN "rental_initial_payment_pct" DOUBLE PRECISION;
ALTER TABLE "leads" ADD COLUMN "rental_monthly_rate" DOUBLE PRECISION;

-- ============================================================
-- Indexes
-- ============================================================

-- rental_vehicles indexes
CREATE UNIQUE INDEX "rental_vehicles_slug_key" ON "rental_vehicles"("slug");
CREATE INDEX "rental_vehicles_dealer_id_idx" ON "rental_vehicles"("dealer_id");
CREATE INDEX "rental_vehicles_make_model_idx" ON "rental_vehicles"("make", "model");
CREATE INDEX "rental_vehicles_is_active_idx" ON "rental_vehicles"("is_active");
CREATE INDEX "rental_vehicles_slug_idx" ON "rental_vehicles"("slug");

-- rental_companies indexes
CREATE UNIQUE INDEX "rental_companies_name_key" ON "rental_companies"("name");
CREATE UNIQUE INDEX "rental_companies_slug_key" ON "rental_companies"("slug");

-- vehicle_rental_assignments indexes
CREATE INDEX "vehicle_rental_assignments_vehicle_id_idx" ON "vehicle_rental_assignments"("vehicle_id");
CREATE INDEX "vehicle_rental_assignments_rental_company_id_idx" ON "vehicle_rental_assignments"("rental_company_id");
CREATE UNIQUE INDEX "vehicle_rental_assignments_vehicle_id_rental_company_id_key" ON "vehicle_rental_assignments"("vehicle_id", "rental_company_id");

-- rental_matrix_entries indexes
CREATE INDEX "rental_matrix_entries_assignment_id_idx" ON "rental_matrix_entries"("assignment_id");
CREATE UNIQUE INDEX "rental_matrix_entries_assignment_id_annual_mileage_km_contra_key" ON "rental_matrix_entries"("assignment_id", "annual_mileage_km", "contract_months", "initial_payment_pct");

-- leads indexes
CREATE INDEX "leads_rental_vehicle_id_idx" ON "leads"("rental_vehicle_id");
CREATE INDEX "leads_lead_type_idx" ON "leads"("lead_type");

-- ============================================================
-- Foreign Keys
-- ============================================================

ALTER TABLE "rental_vehicles" ADD CONSTRAINT "rental_vehicles_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_rental_assignments" ADD CONSTRAINT "vehicle_rental_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "rental_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_rental_assignments" ADD CONSTRAINT "vehicle_rental_assignments_rental_company_id_fkey" FOREIGN KEY ("rental_company_id") REFERENCES "rental_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rental_matrix_entries" ADD CONSTRAINT "rental_matrix_entries_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "vehicle_rental_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_rental_vehicle_id_fkey" FOREIGN KEY ("rental_vehicle_id") REFERENCES "rental_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
