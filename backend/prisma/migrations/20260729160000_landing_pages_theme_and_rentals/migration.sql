-- AlterTable: nowe opcje prezentacji landingu
ALTER TABLE "landing_pages" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'dark',
ADD COLUMN "hero_position" TEXT NOT NULL DEFAULT 'before',
ADD COLUMN "contact_phone" TEXT,
ADD COLUMN "rental_vehicle_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Wyrównanie schematu z schema.prisma (poprzednia migracja była pisana ręcznie):
-- discount i initial_payment są w modelu typu Int, listing_ids jest polem wymaganym.
UPDATE "landing_pages" SET "listing_ids" = ARRAY[]::TEXT[] WHERE "listing_ids" IS NULL;
UPDATE "landing_pages" SET "rental_vehicle_ids" = ARRAY[]::TEXT[] WHERE "rental_vehicle_ids" IS NULL;

ALTER TABLE "landing_pages" ALTER COLUMN "listing_ids" SET NOT NULL;
ALTER TABLE "landing_pages" ALTER COLUMN "rental_vehicle_ids" SET NOT NULL;
ALTER TABLE "landing_pages" ALTER COLUMN "discount" TYPE INTEGER USING ROUND("discount")::INTEGER;
ALTER TABLE "landing_pages" ALTER COLUMN "initial_payment" TYPE INTEGER USING ROUND("initial_payment")::INTEGER;
