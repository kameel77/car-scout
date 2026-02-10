-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT,
    "listing_url" TEXT,
    "scraped_at" TIMESTAMP(3),
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT,
    "vin" TEXT,
    "price_pln" INTEGER NOT NULL,
    "price_display" TEXT,
    "omnibus_lowest_30d_pln" INTEGER,
    "omnibus_text" TEXT,
    "production_year" INTEGER NOT NULL,
    "mileage_km" INTEGER NOT NULL,
    "fuel_type" TEXT NOT NULL,
    "transmission" TEXT NOT NULL,
    "engine_power_hp" INTEGER,
    "engine_capacity_cm3" INTEGER,
    "drive" TEXT,
    "body_type" TEXT,
    "doors" INTEGER,
    "seats" INTEGER,
    "color" TEXT,
    "paint_type" TEXT,
    "registration_number" TEXT,
    "first_registration_date" TEXT,
    "primary_image_url" TEXT,
    "image_count" INTEGER,
    "image_urls" TEXT[],
    "dealer_id" TEXT,
    "equipment_audio_multimedia" TEXT[],
    "equipment_safety" TEXT[],
    "equipment_comfort_extras" TEXT[],
    "equipment_other" TEXT[],
    "additional_info_header" TEXT,
    "additional_info_content" TEXT,
    "specs_json" JSONB,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "archived_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "address_line3" TEXT,
    "city" TEXT,
    "contact_phone" TEXT,
    "google_rating" DOUBLE PRECISION,
    "google_review_count" INTEGER,
    "google_link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "price_pln" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" TEXT NOT NULL,
    "imported_by" TEXT NOT NULL,
    "file_name" TEXT,
    "total_rows" INTEGER NOT NULL,
    "inserted" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "archived" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error_log" JSONB,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listings_listing_id_key" ON "listings"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "listings_vin_key" ON "listings"("vin");

-- CreateIndex
CREATE INDEX "listings_make_model_idx" ON "listings"("make", "model");

-- CreateIndex
CREATE INDEX "listings_price_pln_idx" ON "listings"("price_pln");

-- CreateIndex
CREATE INDEX "listings_production_year_idx" ON "listings"("production_year");

-- CreateIndex
CREATE INDEX "listings_is_archived_idx" ON "listings"("is_archived");

-- CreateIndex
CREATE INDEX "listings_vin_idx" ON "listings"("vin");

-- CreateIndex
CREATE INDEX "listings_listing_id_idx" ON "listings"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealers_name_address_line1_key" ON "dealers"("name", "address_line1");

-- CreateIndex
CREATE INDEX "price_history_listing_id_changed_at_idx" ON "price_history"("listing_id", "changed_at");

-- CreateIndex
CREATE INDEX "import_logs_imported_by_idx" ON "import_logs"("imported_by");

-- CreateIndex
CREATE INDEX "import_logs_imported_at_idx" ON "import_logs"("imported_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
