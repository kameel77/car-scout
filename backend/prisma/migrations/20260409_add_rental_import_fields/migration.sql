-- AlterTable: Add car_class and model_code to rental_vehicles
ALTER TABLE "rental_vehicles" ADD COLUMN IF NOT EXISTS "car_class" TEXT;
ALTER TABLE "rental_vehicles" ADD COLUMN IF NOT EXISTS "model_code" TEXT;

-- AlterTable: Make productionYear, catalogPrice, sellingPrice nullable
ALTER TABLE "rental_vehicles" ALTER COLUMN "production_year" DROP NOT NULL;
ALTER TABLE "rental_vehicles" ALTER COLUMN "catalog_price" DROP NOT NULL;
ALTER TABLE "rental_vehicles" ALTER COLUMN "selling_price" DROP NOT NULL;

-- AlterTable: Add financial columns to rental_matrix_entries
ALTER TABLE "rental_matrix_entries" ADD COLUMN IF NOT EXISTS "over_mileage_cost" DOUBLE PRECISION;
ALTER TABLE "rental_matrix_entries" ADD COLUMN IF NOT EXISTS "insurance_excess_500" DOUBLE PRECISION;
ALTER TABLE "rental_matrix_entries" ADD COLUMN IF NOT EXISTS "insurance_no_limit" DOUBLE PRECISION;
ALTER TABLE "rental_matrix_entries" ADD COLUMN IF NOT EXISTS "tires_no_limit" DOUBLE PRECISION;
