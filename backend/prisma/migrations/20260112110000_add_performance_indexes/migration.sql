-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_broker_price_pln_idx" ON "listings"("broker_price_pln");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_broker_price_eur_idx" ON "listings"("broker_price_eur");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_created_at_idx" ON "listings"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_production_year_idx" ON "listings"("production_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_mileage_km_idx" ON "listings"("mileage_km");
