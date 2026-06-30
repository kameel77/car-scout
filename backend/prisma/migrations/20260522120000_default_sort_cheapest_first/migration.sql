-- Switch default sort to cheapest-first and migrate rows still on the previous defaults.

-- ALTER TABLE "app_settings" ALTER COLUMN "default_sort_cars" SET DEFAULT 'price_asc';
-- ALTER TABLE "app_settings" ALTER COLUMN "default_sort_rental" SET DEFAULT 'minMonthlyRateNet_asc';
-- 
-- UPDATE "app_settings" SET "default_sort_cars" = 'price_asc' WHERE "default_sort_cars" = 'year_desc';
-- UPDATE "app_settings" SET "default_sort_rental" = 'minMonthlyRateNet_asc' WHERE "default_sort_rental" = 'createdAt_desc';
