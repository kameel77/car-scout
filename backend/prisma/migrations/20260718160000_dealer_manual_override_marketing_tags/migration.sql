-- Dealer: ręczne edycje w backoffice chronione przed nadpisaniem przez import CSFlow
ALTER TABLE "dealers" ADD COLUMN "manual_override" BOOLEAN NOT NULL DEFAULT false;

-- Listing: tagi marketingowe wyświetlane na karcie oferty
ALTER TABLE "listings" ADD COLUMN "marketing_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
