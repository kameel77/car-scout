-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "financing_calculator_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "financing_calculator_location" TEXT NOT NULL DEFAULT 'main';

-- CreateTable
CREATE TABLE "financing_products" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "reference_rate" DOUBLE PRECISION NOT NULL,
    "margin" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "max_initial_payment" DOUBLE PRECISION NOT NULL,
    "max_final_payment" DOUBLE PRECISION NOT NULL,
    "min_installments" INTEGER NOT NULL,
    "max_installments" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financing_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financing_products_category_idx" ON "financing_products"("category");

-- CreateIndex
CREATE INDEX "financing_products_is_default_idx" ON "financing_products"("is_default");
