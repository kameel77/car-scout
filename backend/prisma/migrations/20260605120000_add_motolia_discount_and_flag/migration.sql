-- Add Motolia discount amount (source of truth) and a per-listing flag to show it on the frontend.

ALTER TABLE "listings" ADD COLUMN "motolia_discount_pln" INTEGER;
ALTER TABLE "listings" ADD COLUMN "show_motolia_discount" BOOLEAN NOT NULL DEFAULT false;
