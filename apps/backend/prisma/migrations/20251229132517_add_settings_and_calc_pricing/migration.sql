-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "broker_price_eur" INTEGER,
ADD COLUMN     "broker_price_pln" INTEGER,
ADD COLUMN     "dealer_price_net_eur" DOUBLE PRECISION,
ADD COLUMN     "dealer_price_net_pln" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled_languages" TEXT[] DEFAULT ARRAY['pl']::TEXT[],
    "display_currency" TEXT NOT NULL DEFAULT 'PLN',
    "eur_ex_rate" DOUBLE PRECISION NOT NULL DEFAULT 4.30,
    "broker_fee_pct_pln" DOUBLE PRECISION NOT NULL DEFAULT 3.5,
    "broker_fee_pct_eur" DOUBLE PRECISION NOT NULL DEFAULT 3.5,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
