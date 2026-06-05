-- Per-listing toggle: which price is shown as "Cena pojazdu" on the frontend.
-- false (default) = financing price (price_pln); true = financing price + Motolia discount (sale price).

ALTER TABLE "listings" ADD COLUMN "display_sale_price" BOOLEAN NOT NULL DEFAULT false;
