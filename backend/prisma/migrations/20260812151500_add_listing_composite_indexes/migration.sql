-- CreateIndex
CREATE INDEX "listings_is_archived_broker_price_pln_idx" ON "listings"("is_archived", "broker_price_pln");

-- CreateIndex
CREATE INDEX "listings_is_archived_created_at_idx" ON "listings"("is_archived", "created_at");
