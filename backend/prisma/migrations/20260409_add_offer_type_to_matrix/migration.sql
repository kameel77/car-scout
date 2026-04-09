-- AlterTable: Add offer_type column with default 'all'
ALTER TABLE "rental_matrix_entries" ADD COLUMN IF NOT EXISTS "offer_type" TEXT NOT NULL DEFAULT 'all';

-- Drop old unique constraint and create new one including offer_type
ALTER TABLE "rental_matrix_entries" DROP CONSTRAINT IF EXISTS "rental_matrix_entries_assignment_id_annual_mileage_km_contra_key";

CREATE UNIQUE INDEX IF NOT EXISTS "rental_matrix_entries_assignment_id_annual_mileage_km_contra_key"
  ON "rental_matrix_entries"("assignment_id", "annual_mileage_km", "contract_months", "initial_payment_pct", "offer_type");
